use crate::models::{Plugin, Repository, SecurityLevel, SecurityReport};
use crate::security::SecurityScanner;
use crate::services::claude_cli::{ClaudeCli, ClaudeCommand};
use crate::services::{Database, GitHubService};
use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use which::which;

#[derive(Debug, Deserialize)]
struct MarketplaceManifest {
    name: String,
    #[allow(dead_code)]
    description: Option<String>,
    plugins: Vec<MarketplacePluginEntry>,
}

#[derive(Debug, Deserialize)]
struct MarketplacePluginEntry {
    name: String,
    description: Option<String>,
    version: Option<String>,
    source: String,
    author: Option<AuthorField>,
}

#[derive(Debug, Deserialize)]
struct PluginManifest {
    name: String,
    description: Option<String>,
    version: Option<String>,
    author: Option<AuthorField>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum AuthorField {
    Simple(String),
    Detailed { name: Option<String>, email: Option<String> },
}

impl AuthorField {
    fn to_display(&self) -> Option<String> {
        match self {
            AuthorField::Simple(value) => Some(value.clone()),
            AuthorField::Detailed { name, email } => match (name, email) {
                (Some(name), Some(email)) => Some(format!("{} <{}>", name, email)),
                (Some(name), None) => Some(name.clone()),
                (None, Some(email)) => Some(email.clone()),
                (None, None) => None,
            },
        }
    }
}

#[derive(Debug)]
struct ResolvedPlugin {
    plugin: Plugin,
    source_path: PathBuf,
}

#[derive(Debug, Serialize)]
pub struct PluginInstallStatus {
    pub plugin_id: String,
    pub plugin_name: String,
    pub status: String,
    pub output: String,
}

#[derive(Debug, Serialize)]
pub struct PluginInstallResult {
    pub marketplace_name: String,
    pub marketplace_repo: String,
    pub marketplace_status: String,
    pub raw_log: String,
    pub plugin_statuses: Vec<PluginInstallStatus>,
}

#[derive(Debug, Serialize)]
pub struct PluginUninstallResult {
    pub plugin_id: String,
    pub plugin_name: String,
    pub success: bool,
    pub raw_log: String,
}

#[derive(Debug, Serialize)]
pub struct MarketplaceRemoveResult {
    pub marketplace_name: String,
    pub marketplace_repo: String,
    pub success: bool,
    pub removed_plugins_count: usize,
    pub raw_log: String,
}

pub struct PluginManager {
    db: Arc<Database>,
    github: GitHubService,
    scanner: SecurityScanner,
}

impl PluginManager {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            github: GitHubService::new(),
            scanner: SecurityScanner::new(),
        }
    }

    pub fn scan_cached_repository_plugins(&self, cache_path: &Path, repo_url: &str) -> Result<Vec<Plugin>> {
        let repo_root = find_repo_root(cache_path)?;
        let manifest = match read_marketplace_manifest(&repo_root) {
            Ok(Some(manifest)) => manifest,
            Ok(None) => return Ok(Vec::new()),
            Err(e) => {
                log::warn!("读取 marketplace.json 失败: {}", e);
                return Ok(Vec::new());
            }
        };

        let existing_plugins = self.db.get_plugins().unwrap_or_default();
        let existing_map: HashMap<String, Plugin> = existing_plugins
            .into_iter()
            .map(|plugin| (plugin.id.clone(), plugin))
            .collect();

        let mut plugins = Vec::new();
        for entry in manifest.plugins {
            let source = normalize_source(&entry.source);
            let source_path = match resolve_source_path(&repo_root, &source) {
                Ok(path) => path,
                Err(e) => {
                    log::warn!("插件路径无效，跳过: {} ({})", entry.name, e);
                    continue;
                }
            };

            let plugin_manifest = read_plugin_manifest(&source_path).ok();
            let name = plugin_manifest
                .as_ref()
                .map(|m| m.name.clone())
                .unwrap_or_else(|| entry.name.clone());

            let mut plugin = Plugin::new(
                name,
                repo_url.to_string(),
                manifest.name.clone(),
                source.clone(),
            );

            plugin.description = plugin_manifest
                .as_ref()
                .and_then(|m| m.description.clone())
                .or(entry.description.clone());
            plugin.version = plugin_manifest
                .as_ref()
                .and_then(|m| m.version.clone())
                .or(entry.version.clone());
            plugin.author = plugin_manifest
                .as_ref()
                .and_then(|m| m.author.as_ref().and_then(|a| a.to_display()))
                .or(entry.author.as_ref().and_then(|a| a.to_display()));

            // 不再要求 plugin.json 存在，marketplace.json 里的 plugins 条目足够 Claude Code CLI 安装

            if let Some(existing) = existing_map.get(&plugin.id) {
                plugin.installed = existing.installed;
                plugin.installed_at = existing.installed_at;
                plugin.security_score = existing.security_score;
                plugin.security_level = existing.security_level.clone();
                plugin.security_issues = existing.security_issues.clone();
                plugin.scanned_at = existing.scanned_at;
                plugin.staging_path = existing.staging_path.clone();
                plugin.install_log = existing.install_log.clone();
                // 清除旧的 "unsupported" 状态，保留其他有效状态（如 blocked, installed 等）
                let status = existing.install_status.clone();
                if status.as_deref() != Some("unsupported") {
                    plugin.install_status = status.or(plugin.install_status);
                }
            }

            plugins.push(plugin);
        }

        Ok(plugins)
    }

    pub async fn prepare_plugin_installation(&self, plugin_id: &str, locale: &str) -> Result<SecurityReport> {
        let plugin = self.db.get_plugins()?
            .into_iter()
            .find(|p| p.id == plugin_id)
            .context("未找到该插件")?;

        let repositories = self.db.get_repositories()?;
        let repo = repositories.iter()
            .find(|r| r.url == plugin.repository_url)
            .context("未找到对应的仓库记录")?
            .clone();

        let cache_path = if let Some(existing_cache_path) = &repo.cache_path {
            let cache_path_buf = PathBuf::from(existing_cache_path);
            if cache_path_buf.exists() {
                cache_path_buf
            } else {
                self.download_and_cache_repository(&repo.id, &plugin.repository_url).await?
            }
        } else {
            self.download_and_cache_repository(&repo.id, &plugin.repository_url).await?
        };

        let repo_root = find_repo_root(&cache_path)?;
        let mut resolved_plugins = resolve_marketplace_plugins(
            &repo_root,
            &plugin.repository_url,
            false,  // 不强制要求 plugin.json 存在
        )?;

        if resolved_plugins.is_empty() {
            anyhow::bail!("未发现可安装的插件");
        }

        let existing_plugins = self.db.get_plugins().unwrap_or_default();
        let existing_map: HashMap<String, Plugin> = existing_plugins
            .into_iter()
            .map(|plugin| (plugin.id.clone(), plugin))
            .collect();

        for resolved in &mut resolved_plugins {
            if let Some(existing) = existing_map.get(&resolved.plugin.id) {
                resolved.plugin.installed = existing.installed;
                resolved.plugin.installed_at = existing.installed_at;
                resolved.plugin.install_log = existing.install_log.clone();
                resolved.plugin.install_status = existing.install_status.clone();
            }
        }

        let marketplace_name = resolved_plugins
            .first()
            .map(|p| p.plugin.marketplace_name.clone())
            .unwrap_or_else(|| plugin.marketplace_name.clone());

        let mut reports = Vec::new();
        for resolved in &resolved_plugins {
            let report = self.scanner.scan_directory(
                resolved.source_path.to_str().context("插件目录路径无效")?,
                &resolved.plugin.id,
                locale,
            )?;
            reports.push((resolved.plugin.clone(), report));
        }

        let merged_report = merge_reports(&reports, &marketplace_name);

        let now = Utc::now();
        let blocked = merged_report.blocked;
        for (plugin_entry, report) in reports {
            let mut updated = plugin_entry.clone();
            updated.security_score = Some(report.score);
            updated.security_level = Some(report.level.as_str().to_string());
            updated.security_issues = Some(
                report.issues.iter()
                    .map(|i| {
                        let file_info = i.file_path.as_ref()
                            .map(|f| format!("[{}] ", f))
                            .unwrap_or_default();
                        format!("{}{:?}: {}", file_info, i.severity, i.description)
                    })
                    .collect()
            );
            updated.scanned_at = Some(now);
            updated.staging_path = Some(repo_root.to_string_lossy().to_string());
            if blocked && !updated.installed {
                updated.install_status = Some("blocked".to_string());
            }
            self.db.save_plugin(&updated)?;
        }

        if blocked {
            let mut error_msg = "安全检测发现严重威胁，已禁止安装。\n\n检测到以下高危操作：\n".to_string();
            for (idx, issue) in merged_report.hard_trigger_issues.iter().enumerate() {
                error_msg.push_str(&format!("{}. {}\n", idx + 1, issue));
            }
            error_msg.push_str("\n这些操作可能对您的系统造成严重危害，强烈建议不要安装此插件。");
            anyhow::bail!(error_msg);
        }

        Ok(merged_report)
    }

    pub async fn confirm_plugin_installation(
        &self,
        plugin_id: &str,
        claude_command: Option<String>,
    ) -> Result<PluginInstallResult> {
        let plugin = self.db.get_plugins()?
            .into_iter()
            .find(|p| p.id == plugin_id)
            .context("未找到该插件")?;

        if plugin.install_status.as_deref() == Some("blocked") {
            anyhow::bail!("安全扫描未通过，已阻止插件安装");
        }

        if plugin.staging_path.is_none() {
            anyhow::bail!("插件尚未准备，请先进行安装前扫描");
        }

        if let Some(staging_path) = &plugin.staging_path {
            let staging_path_buf = PathBuf::from(staging_path);
            if !staging_path_buf.exists() {
                anyhow::bail!("安装缓存已失效，请重新进行安装前扫描");
            }
        }

        let (owner, repo_name) = Repository::from_github_url(&plugin.repository_url)?;
        let marketplace_repo = format!("{}/{}", owner, repo_name);
        let marketplace_name = plugin.marketplace_name.clone();

        let cli_command = claude_command.unwrap_or_else(|| "claude".to_string());
        if which(&cli_command).is_err() {
            let mut message = format!("未找到 Claude Code CLI: {}", cli_command);
            if which("codex").is_ok() {
                message.push_str("\n检测到 Codex，但该流程仅支持 Claude Code Plugin。");
            }
            if which("opencode").is_ok() {
                message.push_str("\n检测到 OpenCode，但该流程仅支持 Claude Code Plugin。");
            }
            anyhow::bail!(message);
        }
        let claude_cli = ClaudeCli::new(cli_command);

        // 构建命令：1. marketplace add，2. 只安装选中的单个 plugin
        let mut commands = Vec::new();
        commands.push(ClaudeCommand {
            args: vec![
                "plugin".to_string(),
                "marketplace".to_string(),
                "add".to_string(),
                marketplace_repo.clone(),
            ],
            timeout: Duration::from_secs(60),
        });

        // 只安装选中的单个 plugin
        commands.push(ClaudeCommand {
            args: vec![
                "plugin".to_string(),
                "install".to_string(),
                plugin.plugin_spec(),
            ],
            timeout: Duration::from_secs(180),
        });

        let cli_result = claude_cli.run(&commands)?;
        let mut outputs = cli_result.outputs.into_iter();

        let marketplace_output = outputs
            .next()
            .map(|o| o.output)
            .unwrap_or_default();

        let marketplace_outcome = parse_marketplace_add_output(&marketplace_output);
        let marketplace_status = if marketplace_outcome.success {
            if marketplace_outcome.already {
                "already_added"
            } else {
                "added"
            }
        } else {
            "failed"
        };

        let now = Utc::now();
        let mut plugin_statuses = Vec::new();

        // 只处理选中的单个 plugin
        let output = outputs.next().map(|o| o.output).unwrap_or_default();
        let outcome = parse_plugin_install_output(&output);
        let status = if outcome.success {
            if outcome.already {
                "already_installed"
            } else {
                "installed"
            }
        } else {
            "failed"
        };

        let mut updated = plugin.clone();
        updated.install_status = Some(status.to_string());
        updated.install_log = Some(cli_result.raw_log.clone());
        updated.staging_path = None;
        if outcome.success {
            updated.installed = true;
            updated.installed_at = Some(now);
        }
        self.db.save_plugin(&updated)?;

        plugin_statuses.push(PluginInstallStatus {
            plugin_id: updated.id,
            plugin_name: updated.name,
            status: status.to_string(),
            output,
        });

        Ok(PluginInstallResult {
            marketplace_name,
            marketplace_repo,
            marketplace_status: marketplace_status.to_string(),
            raw_log: cli_result.raw_log,
            plugin_statuses,
        })
    }

    pub fn cancel_plugin_installation(&self, plugin_id: &str) -> Result<()> {
        let plugin = self.db.get_plugins()?
            .into_iter()
            .find(|p| p.id == plugin_id)
            .context("未找到该插件")?;

        // 只清除选中的单个 plugin 的 staging_path
        let mut updated = plugin.clone();
        updated.staging_path = None;
        self.db.save_plugin(&updated)?;

        Ok(())
    }

    /// 卸载单个 plugin
    pub async fn uninstall_plugin(
        &self,
        plugin_id: &str,
        claude_command: Option<String>,
    ) -> Result<PluginUninstallResult> {
        let plugin = self.db.get_plugins()?
            .into_iter()
            .find(|p| p.id == plugin_id)
            .context("未找到该插件")?;

        if !plugin.installed {
            anyhow::bail!("该插件尚未安装");
        }

        let cli_command = claude_command.unwrap_or_else(|| "claude".to_string());
        if which(&cli_command).is_err() {
            anyhow::bail!("未找到 Claude Code CLI: {}", cli_command);
        }
        let claude_cli = ClaudeCli::new(cli_command);

        let commands = vec![
            ClaudeCommand {
                args: vec![
                    "plugin".to_string(),
                    "uninstall".to_string(),
                    plugin.plugin_spec(),
                ],
                timeout: Duration::from_secs(60),
            },
        ];

        let cli_result = claude_cli.run(&commands)?;
        let output = cli_result.outputs
            .first()
            .map(|o| o.output.clone())
            .unwrap_or_default();

        let outcome = parse_plugin_uninstall_output(&output);

        let mut updated = plugin.clone();
        if outcome.success {
            updated.installed = false;
            updated.installed_at = None;
            updated.install_status = Some("uninstalled".to_string());
        } else {
            updated.install_status = Some("uninstall_failed".to_string());
        }
        updated.install_log = Some(cli_result.raw_log.clone());
        self.db.save_plugin(&updated)?;

        Ok(PluginUninstallResult {
            plugin_id: updated.id,
            plugin_name: updated.name,
            success: outcome.success,
            raw_log: cli_result.raw_log,
        })
    }

    /// 移除整个 marketplace（会自动卸载该 marketplace 的所有 plugins）
    pub async fn remove_marketplace(
        &self,
        marketplace_name: &str,
        marketplace_repo: &str,
        claude_command: Option<String>,
    ) -> Result<MarketplaceRemoveResult> {
        let cli_command = claude_command.unwrap_or_else(|| "claude".to_string());
        if which(&cli_command).is_err() {
            anyhow::bail!("未找到 Claude Code CLI: {}", cli_command);
        }
        let claude_cli = ClaudeCli::new(cli_command);

        let commands = vec![
            ClaudeCommand {
                args: vec![
                    "plugin".to_string(),
                    "marketplace".to_string(),
                    "remove".to_string(),
                    marketplace_name.to_string(),
                ],
                timeout: Duration::from_secs(60),
            },
        ];

        let cli_result = claude_cli.run(&commands)?;
        let output = cli_result.outputs
            .first()
            .map(|o| o.output.clone())
            .unwrap_or_default();

        let outcome = parse_marketplace_remove_output(&output);

        // 移除成功后，删除该 marketplace 下的所有 plugin 记录
        let mut removed_count = 0;
        if outcome.success {
            let all_plugins = self.db.get_plugins()?;
            for plugin in all_plugins {
                if plugin.marketplace_name == marketplace_name {
                    // 从数据库删除 plugin 记录
                    self.db.delete_plugin(&plugin.id)?;
                    removed_count += 1;
                }
            }
        }

        Ok(MarketplaceRemoveResult {
            marketplace_name: marketplace_name.to_string(),
            marketplace_repo: marketplace_repo.to_string(),
            success: outcome.success,
            removed_plugins_count: removed_count,
            raw_log: cli_result.raw_log,
        })
    }

    async fn download_and_cache_repository(&self, repo_id: &str, repo_url: &str) -> Result<PathBuf> {
        let (owner, repo_name) = Repository::from_github_url(repo_url)?;
        let cache_base_dir = dirs::cache_dir()
            .context("无法获取系统缓存目录")?
            .join("agent-skills-guard")
            .join("repositories");

        let (extract_dir, commit_sha) = self.github
            .download_repository_archive(&owner, &repo_name, &cache_base_dir)
            .await
            .context("下载仓库压缩包失败")?;

        let cache_path_str = extract_dir.to_string_lossy().to_string();
        self.db.update_repository_cache(
            repo_id,
            &cache_path_str,
            Utc::now(),
            Some(&commit_sha),
        ).context("更新仓库缓存信息失败")?;

        Ok(extract_dir)
    }
}

#[derive(Debug)]
struct CommandOutcome {
    success: bool,
    already: bool,
}

fn parse_marketplace_add_output(output: &str) -> CommandOutcome {
    let text = output.to_lowercase();

    // 检查是否有明确的失败信息
    let has_error = text.contains("error")
        || text.contains("failed")
        || text.contains("failure")
        || text.contains("unable to")
        || text.contains("could not");

    // 检查是否已存在
    let already = text.contains("already") && (text.contains("marketplace") || text.contains("exists") || text.contains("added"));

    // 检查成功情况（排除错误情况）
    let success = !has_error && (
        already
        || text.contains("marketplace added")
        || text.contains("added marketplace")
        || text.contains("successfully added")
        || (text.contains("marketplace") && text.contains("added") && !text.contains("not added"))
    );

    CommandOutcome { success, already }
}

fn parse_plugin_install_output(output: &str) -> CommandOutcome {
    let text = output.to_lowercase();

    // 检查是否有明确的失败信息
    let has_error = text.contains("error")
        || text.contains("failed")
        || text.contains("failure")
        || text.contains("unable to")
        || text.contains("could not");

    // 检查是否未安装（否定）
    let not_installed = text.contains("not installed") || text.contains("not found");

    // 检查是否已存在
    let already = text.contains("already installed") || text.contains("already exists");

    // 检查成功情况（排除错误和否定情况）
    let success = !has_error && !not_installed && (
        already
        || text.contains("successfully installed")
        || text.contains("installation complete")
        || text.contains("install success")
        || text.contains("plugin installed")
        // 只有当 "installed" 不是在否定上下文中出现时才算成功
        || (text.contains("installed") && !text.contains("not installed") && !text.contains("isn't installed"))
    );

    CommandOutcome { success, already }
}

fn parse_plugin_uninstall_output(output: &str) -> CommandOutcome {
    let text = output.to_lowercase();

    // 检查是否本来就未安装（可视为"成功"卸载）
    // 优先检查这个，因为 "not found" 比一般错误更具体
    let not_installed = text.contains("not installed")
        || text.contains("not found")
        || text.contains("doesn't exist")
        || (text.contains("not found") && text.contains("installed plugins"));

    // 检查是否有明确的失败信息（排除 "not found" 的情况）
    let has_error = !not_installed && (
        text.contains("error")
        || text.contains("failed")
        || text.contains("failure")
        || text.contains("unable to")
        || text.contains("could not")
    );

    // 检查成功情况
    let success = !has_error && (
        not_installed  // 本来就不存在，视为成功
        || text.contains("successfully uninstalled")
        || text.contains("uninstall success")
        || text.contains("plugin uninstalled")
        || text.contains("removed")
        || (text.contains("uninstalled") && !text.contains("not uninstalled"))
    );

    CommandOutcome { success, already: not_installed }
}

fn parse_marketplace_remove_output(output: &str) -> CommandOutcome {
    let text = output.to_lowercase();

    // 检查是否本来就不存在（可视为"成功"移除）
    let not_found = text.contains("not found")
        || text.contains("doesn't exist")
        || (text.contains("marketplace") && text.contains("not found"));

    // 检查是否有明确的失败信息（排除 "not found" 的情况）
    let has_error = !not_found && (
        text.contains("error")
        || text.contains("failed")
        || text.contains("failure")
        || text.contains("unable to")
        || text.contains("could not")
    );

    // 检查成功情况
    let success = !has_error && (
        not_found  // 本来就不存在，视为成功
        || text.contains("successfully removed")
        || text.contains("marketplace removed")
        || text.contains("removed marketplace")
        || text.contains("uninstalled")
        || (text.contains("removed") && !text.contains("not removed"))
    );

    CommandOutcome { success, already: not_found }
}

fn read_marketplace_manifest(repo_root: &Path) -> Result<Option<MarketplaceManifest>> {
    let manifest_path = repo_root.join(".claude-plugin").join("marketplace.json");
    if !manifest_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("无法读取 marketplace.json: {:?}", manifest_path))?;

    let manifest: MarketplaceManifest = serde_json::from_str(&content)
        .context("解析 marketplace.json 失败")?;

    Ok(Some(manifest))
}

fn read_plugin_manifest(source_path: &Path) -> Result<PluginManifest> {
    let manifest_path = source_path.join(".claude-plugin").join("plugin.json");
    let content = std::fs::read_to_string(&manifest_path)
        .with_context(|| format!("无法读取 plugin.json: {:?}", manifest_path))?;
    let manifest: PluginManifest = serde_json::from_str(&content)
        .context("解析 plugin.json 失败")?;
    Ok(manifest)
}

fn normalize_source(source: &str) -> String {
    let mut trimmed = source.trim().to_string();
    if trimmed == "." || trimmed == "./" {
        return ".".to_string();
    }

    if trimmed.starts_with("./") {
        trimmed = trimmed.trim_start_matches("./").to_string();
    }

    trimmed = trimmed.trim_end_matches('/').trim_end_matches('\\').to_string();
    if trimmed.is_empty() {
        ".".to_string()
    } else {
        trimmed
    }
}

fn resolve_source_path(repo_root: &Path, source: &str) -> Result<PathBuf> {
    let normalized = normalize_source(source);
    if normalized == "." {
        return Ok(repo_root.to_path_buf());
    }

    let relative = PathBuf::from(&normalized);
    for component in relative.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                anyhow::bail!("插件 source 路径不允许包含上级或绝对路径: {}", normalized);
            }
            Component::CurDir | Component::Normal(_) => {}
        }
    }

    Ok(repo_root.join(relative))
}

fn find_repo_root(extract_dir: &Path) -> Result<PathBuf> {
    for entry in std::fs::read_dir(extract_dir)
        .context("无法读取解压目录")?
    {
        let entry = entry.context("无法读取目录条目")?;
        if entry.file_type()?.is_dir() {
            return Ok(entry.path());
        }
    }

    anyhow::bail!("未找到仓库根目录")
}

fn resolve_marketplace_plugins(
    repo_root: &Path,
    repo_url: &str,
    strict: bool,
) -> Result<Vec<ResolvedPlugin>> {
    let manifest = read_marketplace_manifest(repo_root)?
        .context("未找到 marketplace.json，无法自动安装插件")?;

    let mut resolved = Vec::new();
    for entry in manifest.plugins {
        let source = normalize_source(&entry.source);
        let source_path = resolve_source_path(repo_root, &source)?;
        if !source_path.exists() {
            anyhow::bail!("插件目录不存在: {}", source_path.to_string_lossy());
        }

        let plugin_manifest = match read_plugin_manifest(&source_path) {
            Ok(manifest) => Some(manifest),
            Err(e) => {
                if strict {
                    return Err(e);
                }
                None
            }
        };

        let name = plugin_manifest
            .as_ref()
            .map(|m| m.name.clone())
            .unwrap_or_else(|| entry.name.clone());

        let mut plugin = Plugin::new(
            name,
            repo_url.to_string(),
            manifest.name.clone(),
            source.clone(),
        );

        plugin.description = plugin_manifest
            .as_ref()
            .and_then(|m| m.description.clone())
            .or(entry.description.clone());
        plugin.version = plugin_manifest
            .as_ref()
            .and_then(|m| m.version.clone())
            .or(entry.version.clone());
        plugin.author = plugin_manifest
            .as_ref()
            .and_then(|m| m.author.as_ref().and_then(|a| a.to_display()))
            .or(entry.author.as_ref().and_then(|a| a.to_display()));

        resolved.push(ResolvedPlugin { plugin, source_path });
    }

    Ok(resolved)
}

fn merge_reports(reports: &[(Plugin, SecurityReport)], marketplace_name: &str) -> SecurityReport {
    let mut issues = Vec::new();
    let mut hard_triggers = Vec::new();
    let mut scanned_files = Vec::new();
    let mut recommendations = HashSet::new();
    let mut score = 100;
    let mut blocked = false;

    for (plugin, report) in reports {
        if report.score < score {
            score = report.score;
        }

        if report.blocked {
            blocked = true;
        }

        for issue in &report.issues {
            let mut updated = issue.clone();
            if let Some(path) = &issue.file_path {
                updated.file_path = Some(format!("{}/{}", plugin.name, path));
            }
            issues.push(updated);
        }

        for file in &report.scanned_files {
            scanned_files.push(format!("{}/{}", plugin.name, file));
        }

        for item in &report.hard_trigger_issues {
            hard_triggers.push(format!("[{}] {}", plugin.name, item));
        }

        for rec in &report.recommendations {
            recommendations.insert(rec.clone());
        }
    }

    SecurityReport {
        skill_id: format!("marketplace::{}", marketplace_name),
        score,
        level: SecurityLevel::from_score(score),
        issues,
        recommendations: recommendations.into_iter().collect(),
        blocked,
        hard_trigger_issues: hard_triggers,
        scanned_files,
    }
}
