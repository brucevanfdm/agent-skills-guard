use crate::models::Skill;
use crate::security::SecurityScanner;
use crate::services::{Database, GitHubService};
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::sync::Arc;
use chrono::Utc;

pub struct SkillManager {
    db: Arc<Database>,
    github: GitHubService,
    scanner: SecurityScanner,
    skills_dir: PathBuf,
}

impl SkillManager {
    pub fn new(db: Arc<Database>) -> Self {
        let skills_dir = Self::get_skills_directory();

        Self {
            db,
            github: GitHubService::new(),
            scanner: SecurityScanner::new(),
            skills_dir,
        }
    }

    /// 获取 skills 安装目录
    fn get_skills_directory() -> PathBuf {
        let home = dirs::home_dir().expect("Failed to get home directory");
        home.join(".claude").join("skills")
    }

    /// 下载并分析 skill，返回文件内容和安全报告
    pub async fn download_and_analyze(&self, skill: &mut Skill) -> Result<(Vec<u8>, crate::models::SecurityReport)> {
        // 构建下载 URL
        let (owner, repo) = crate::models::Repository::from_github_url(&skill.repository_url)?;

        // 下载 SKILL.md 文件
        let download_url = format!(
            "https://raw.githubusercontent.com/{}/{}/main/{}/SKILL.md",
            owner, repo, skill.file_path
        );

        log::info!("Downloading SKILL.md from: {}", download_url);

        // 下载文件内容
        let content = self.github.download_file(&download_url).await?;

        // 解析 frontmatter 更新 skill 元数据
        let (name, description) = self.github.fetch_skill_metadata(&owner, &repo, &skill.file_path).await?;
        skill.name = name;
        skill.description = description;

        // 安全扫描
        let content_str = String::from_utf8_lossy(&content);
        let report = self.scanner.scan_file(&content_str, "SKILL.md", "zh")?;

        // 更新 skill 信息
        skill.security_score = Some(report.score);
        skill.security_level = Some(report.level.as_str().to_string());
        skill.security_issues = Some(
            report.issues.iter()
                .map(|i| format!("{:?}: {}", i.severity, i.description))
                .collect()
        );
        skill.scanned_at = Some(Utc::now());
        skill.checksum = Some(self.scanner.calculate_checksum(&content));

        Ok((content, report))
    }

    /// 安装 skill 到本地
    pub async fn install_skill(&self, skill_id: &str) -> Result<()> {
        // 从数据库获取 skill
        let mut skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("未找到该技能，请检查技能是否存在")?;

        // 下载并分析 SKILL.md（用于元数据提取）
        let (_skill_md_content, _report) = self.download_and_analyze(&mut skill).await?;

        // 确保目标目录存在
        std::fs::create_dir_all(&self.skills_dir)
            .context("无法创建技能目录，请检查磁盘权限")?;

        // 创建 skill 文件夹（使用 skill 的文件夹名）
        // 如果 file_path 是 "."（位于仓库根目录），使用技能名称作为文件夹名
        let skill_folder_name = if skill.file_path == "." {
            log::info!("技能位于仓库根目录，使用技能名称作为文件夹名: {}", skill.name);
            skill.name.clone()
        } else {
            PathBuf::from(&skill.file_path)
                .file_name()
                .context("技能路径格式无效")?
                .to_str()
                .context("技能文件夹名称包含无效字符")?
                .to_string()
        };

        let skill_dir = self.skills_dir.join(&skill_folder_name);
        std::fs::create_dir_all(&skill_dir)
            .context("无法创建技能子目录，请检查磁盘空间和权限")?;

        // 下载整个 skill 目录的所有文件
        let (owner, repo) = crate::models::Repository::from_github_url(&skill.repository_url)?;
        // 如果 file_path 是 "."，转换为空字符串以获取根目录内容
        let api_path = if skill.file_path == "." { "" } else { &skill.file_path };
        let skill_files = self.github.get_directory_files(&owner, &repo, api_path).await
            .context("获取技能目录文件列表失败")?;

        log::info!("Found {} files in skill directory", skill_files.len());

        // 下载每个文件
        for file_info in &skill_files {
            if file_info.content_type != "file" {
                continue; // 跳过子目录
            }

            // 获取 download_url
            let download_url = file_info.download_url.as_ref()
                .context(format!("文件 {} 缺少下载链接", file_info.name))?;

            let file_content = self.github.download_file(download_url).await
                .context(format!("下载文件失败: {}", file_info.name))?;

            // 写入文件到本地
            let local_file_path = skill_dir.join(&file_info.name);
            std::fs::write(&local_file_path, file_content)
                .context(format!("无法写入文件: {}", file_info.name))?;

            log::info!("Saved file: {}", file_info.name);
        }

        // 扫描整个技能目录
        let scan_report = self.scanner.scan_directory(
            skill_dir.to_str().context("技能目录路径无效")?,
            &skill.id,
            "zh"
        )?;

        log::info!("Security scan completed: score={}, scanned {} files",
            scan_report.score, scan_report.scanned_files.len());

        // 检查是否被 hard_trigger 阻止
        if scan_report.blocked {
            // 先删除已下载的文件
            if skill_dir.exists() {
                std::fs::remove_dir_all(&skill_dir)?;
            }

            let mut error_msg = format!(
                "⛔ 安全检测发现严重威胁，禁止安装！\n\n检测到以下高危操作：\n"
            );
            for (idx, issue) in scan_report.hard_trigger_issues.iter().enumerate() {
                error_msg.push_str(&format!("{}. {}\n", idx + 1, issue));
            }
            error_msg.push_str("\n这些操作可能对您的系统造成严重危害，强烈建议不要安装此技能。");
            anyhow::bail!(error_msg);
        }

        // 注释掉评分检查，允许用户在前端确认后安装低分技能
        // 只有硬触发的技能会被后端强制阻止
        // if scan_report.score < 50 {
        //     // 先删除已下载的文件
        //     if skill_dir.exists() {
        //         std::fs::remove_dir_all(&skill_dir)?;
        //     }
        //
        //     anyhow::bail!(
        //         "技能安全评分过低 ({}分)，为保护您的安全已阻止安装。建议评分至少为 50 分以上。\n\n扫描了 {} 个文件：{}",
        //         scan_report.score,
        //         scan_report.scanned_files.len(),
        //         scan_report.scanned_files.join(", ")
        //     );
        // }

        // 更新 skill 安全信息
        skill.security_score = Some(scan_report.score);
        skill.security_level = Some(scan_report.level.as_str().to_string());
        skill.security_issues = Some(
            scan_report.issues.iter()
                .map(|i| {
                    let file_info = i.file_path.as_ref()
                        .map(|f| format!("[{}] ", f))
                        .unwrap_or_default();
                    format!("{}{:?}: {}", file_info, i.severity, i.description)
                })
                .collect()
        );
        skill.scanned_at = Some(Utc::now());

        // 更新数据库
        skill.installed = true;
        skill.installed_at = Some(Utc::now());
        skill.local_path = Some(skill_dir.to_string_lossy().to_string());

        self.db.save_skill(&skill)?;

        log::info!("Skill installed successfully: {}", skill.name);
        Ok(())
    }

    /// 准备安装技能：下载并扫描，但不标记为已安装
    /// 返回扫描报告供前端判断是否需要用户确认
    pub async fn prepare_skill_installation(&self, skill_id: &str, locale: &str) -> Result<crate::models::security::SecurityReport> {
        use anyhow::Context;

        log::info!("Preparing installation for skill: {}", skill_id);

        // 从数据库获取 skill
        let mut skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("未找到该技能")?;

        // 下载并分析 SKILL.md
        let (_skill_md_content, _report) = self.download_and_analyze(&mut skill).await?;

        // 确保目标目录存在
        std::fs::create_dir_all(&self.skills_dir)
            .context("无法创建技能目录")?;

        // 创建 skill 文件夹
        // 如果 file_path 是 "."（位于仓库根目录），使用技能名称作为文件夹名
        let skill_folder_name = if skill.file_path == "." {
            log::info!("技能位于仓库根目录，使用技能名称作为文件夹名: {}", skill.name);
            skill.name.clone()
        } else {
            PathBuf::from(&skill.file_path)
                .file_name()
                .context("技能路径格式无效")?
                .to_str()
                .context("技能文件夹名称包含无效字符")?
                .to_string()
        };

        let skill_dir = self.skills_dir.join(&skill_folder_name);
        std::fs::create_dir_all(&skill_dir)
            .context("无法创建技能子目录")?;

        // 下载整个 skill 目录的所有文件
        let (owner, repo) = crate::models::Repository::from_github_url(&skill.repository_url)?;
        // 如果 file_path 是 "."，转换为空字符串以获取根目录内容
        let api_path = if skill.file_path == "." { "" } else { &skill.file_path };
        let skill_files = self.github.get_directory_files(&owner, &repo, api_path).await
            .context("获取技能目录文件列表失败")?;

        log::info!("Found {} files in skill directory", skill_files.len());

        // 下载每个文件
        for file_info in &skill_files {
            if file_info.content_type != "file" {
                continue;
            }

            let download_url = file_info.download_url.as_ref()
                .context(format!("文件 {} 缺少下载链接", file_info.name))?;

            let file_content = self.github.download_file(download_url).await
                .context(format!("下载文件失败: {}", file_info.name))?;

            let local_file_path = skill_dir.join(&file_info.name);
            std::fs::write(&local_file_path, file_content)
                .context(format!("无法写入文件: {}", file_info.name))?;

            log::info!("Saved file: {}", file_info.name);
        }

        // 扫描整个技能目录
        let scan_report = self.scanner.scan_directory(
            skill_dir.to_str().context("技能目录路径无效")?,
            &skill.id,
            locale
        )?;

        log::info!("Security scan completed: score={}, scanned {} files",
            scan_report.score, scan_report.scanned_files.len());

        // 更新 skill 安全信息到数据库（但不标记为已安装）
        skill.security_score = Some(scan_report.score);
        skill.security_level = Some(scan_report.level.as_str().to_string());
        skill.security_issues = Some(
            scan_report.issues.iter()
                .map(|i| {
                    let file_info = i.file_path.as_ref()
                        .map(|f| format!("[{}] ", f))
                        .unwrap_or_default();
                    format!("{}{:?}: {}", file_info, i.severity, i.description)
                })
                .collect()
        );
        skill.scanned_at = Some(Utc::now());
        skill.local_path = Some(skill_dir.to_string_lossy().to_string());

        // 保存安全信息到数据库，但不标记为已安装
        self.db.save_skill(&skill)?;

        log::info!("Skill prepared successfully, awaiting user confirmation");
        Ok(scan_report)
    }

    /// 确认安装技能：标记为已安装
    pub fn confirm_skill_installation(&self, skill_id: &str, install_path: Option<String>) -> Result<()> {
        use anyhow::Context;
        use std::path::PathBuf;

        log::info!("Confirming installation for skill: {}", skill_id);

        let mut skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("未找到该技能")?;

        // 如果指定了新的安装路径，需要移动文件
        if let Some(new_base_path) = install_path {
            let current_path = skill.local_path.as_ref()
                .context("技能尚未下载")?;

            let current_dir = PathBuf::from(current_path);
            let new_base_dir = PathBuf::from(&new_base_path);

            // 获取技能目录名（当前路径的最后一个部分）
            let skill_dir_name = current_dir.file_name()
                .context("无效的技能目录名")?;
            let new_dir = new_base_dir.join(skill_dir_name);

            // 确保目标基础目录存在
            std::fs::create_dir_all(&new_base_dir)
                .context("无法创建目标目录")?;

            // 移动文件
            if new_dir != current_dir {
                std::fs::rename(&current_dir, &new_dir)
                    .context("移动技能文件失败，请检查目标路径权限")?;

                log::info!("Moved skill from {:?} to {:?}", current_dir, new_dir);

                // 更新 local_path
                skill.local_path = Some(new_dir.to_string_lossy().to_string());
            }
        }

        // 标记为已安装
        skill.installed = true;
        skill.installed_at = Some(Utc::now());

        self.db.save_skill(&skill)?;

        log::info!("Skill installation confirmed: {}", skill.name);
        Ok(())
    }

    /// 取消安装技能：删除已下载的文件
    pub fn cancel_skill_installation(&self, skill_id: &str) -> Result<()> {
        use anyhow::Context;

        log::info!("Canceling installation for skill: {}", skill_id);

        let skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("未找到该技能")?;

        // 删除已下载的文件
        if let Some(local_path) = &skill.local_path {
            let path = PathBuf::from(local_path);
            if path.exists() {
                std::fs::remove_dir_all(&path)
                    .context("无法删除技能文件")?;
                log::info!("Deleted skill files: {}", local_path);
            }
        }

        // 清除数据库中的安全信息和本地路径
        let mut skill = skill;
        skill.local_path = None;
        skill.security_score = None;
        skill.security_level = None;
        skill.security_issues = None;
        skill.scanned_at = None;

        self.db.save_skill(&skill)?;

        log::info!("Skill installation canceled: {}", skill.name);
        Ok(())
    }

    /// 卸载 skill
    pub fn uninstall_skill(&self, skill_id: &str) -> Result<()> {
        // 从数据库获取 skill
        let mut skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("未找到该技能")?;

        // 删除本地文件目录
        if let Some(local_path) = &skill.local_path {
            let path = PathBuf::from(local_path);
            if path.exists() {
                // 如果是目录，删除整个目录
                if path.is_dir() {
                    std::fs::remove_dir_all(&path)
                        .context("无法删除技能目录，请检查文件是否被占用")?;
                } else {
                    std::fs::remove_file(&path)
                        .context("无法删除技能文件，请检查文件是否被占用")?;
                }
            }
        }

        // 更新数据库
        skill.installed = false;
        skill.installed_at = None;
        skill.local_path = None;

        self.db.save_skill(&skill)
            .context("更新数据库失败")?;

        log::info!("Skill uninstalled successfully: {}", skill.name);
        Ok(())
    }

    /// 获取所有 skills
    pub fn get_all_skills(&self) -> Result<Vec<Skill>> {
        self.db.get_skills()
    }

    /// 获取已安装的 skills
    pub fn get_installed_skills(&self) -> Result<Vec<Skill>> {
        let skills = self.db.get_skills()?;
        Ok(skills.into_iter().filter(|s| s.installed).collect())
    }

    /// 扫描本地 ~/.claude/skills/ 目录，导入未追踪的技能
    pub fn scan_local_skills(&self) -> Result<Vec<Skill>> {
        use std::collections::HashSet;

        let mut scanned_skills = Vec::new();  // 所有扫描到的技能
        let mut imported_skills = Vec::new(); // 新导入的技能（用于日志）

        // 获取当前数据库中的所有技能（用于去重和提取路径）
        let existing_skills = self.db.get_skills()?;

        // 1. 获取所有 unique 的 local_path 父目录
        let mut scan_dirs: HashSet<PathBuf> = HashSet::new();

        // 从已安装技能的 local_path 提取父目录
        for skill in &existing_skills {
            if let Some(local_path) = &skill.local_path {
                if let Some(parent) = PathBuf::from(local_path).parent() {
                    scan_dirs.insert(parent.to_path_buf());
                }
            }
        }

        // 2. 添加默认的用户目录（确保始终扫描）
        scan_dirs.insert(self.skills_dir.clone());

        log::info!("Will scan {} directories for local skills", scan_dirs.len());

        // 3. 扫描所有目录
        for scan_dir in scan_dirs {
            if !scan_dir.exists() {
                log::debug!("Skipping non-existent directory: {:?}", scan_dir);
                continue;
            }

            log::info!("Scanning directory: {:?}", scan_dir);

            // 遍历技能目录
            if let Ok(entries) = std::fs::read_dir(&scan_dir) {
            for entry in entries.flatten() {
                let path = entry.path();

                // 只处理目录
                if !path.is_dir() {
                    continue;
                }

                // 检查是否包含 SKILL.md
                let skill_md_path = path.join("SKILL.md");
                if !skill_md_path.exists() {
                    continue;
                }

                // 读取 SKILL.md 内容
                match std::fs::read_to_string(&skill_md_path) {
                    Ok(content) => {
                        // 计算 checksum
                        let checksum = self.scanner.calculate_checksum(content.as_bytes());

                        // 解析 frontmatter 获取元数据（用于去重）
                        let (skill_name, skill_description) = self.parse_frontmatter(&content)
                            .unwrap_or_else(|_| {
                                (
                                    path.file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                    None
                                )
                            });

                        // 检查是否已存在（基于技能名称）
                        if let Some(mut existing_skill) = existing_skills.iter()
                            .find(|s| s.name == skill_name)
                            .cloned()
                        {
                            // 如果已存在但未标记为已安装，更新状态
                            if !existing_skill.installed {
                                existing_skill.installed = true;
                                existing_skill.installed_at = Some(Utc::now());
                                existing_skill.local_path = Some(path.to_string_lossy().to_string());
                                existing_skill.checksum = Some(checksum.clone());

                                // 更新数据库
                                self.db.save_skill(&existing_skill)?;
                                log::info!("Updated existing skill to installed: {}", skill_name);
                            }

                            scanned_skills.push(existing_skill);
                            continue;
                        }

                        // 生成技能 ID
                        let skill_id = format!("local::{}", checksum[..16].to_string());

                        // 扫描整个技能目录
                        let report = self.scanner.scan_directory(
                            path.to_str().unwrap_or(""),
                            &skill_id,
                            "zh"
                        )?;

                        log::info!("Scanned local skill '{}': score={}, files={:?}",
                            skill_name, report.score, report.scanned_files);

                        // 创建 skill 对象（使用之前解析的元数据）
                        let skill = Skill {
                            id: skill_id,
                            name: skill_name,
                            description: skill_description,
                            repository_url: "local".to_string(),
                            repository_owner: Some("local".to_string()),
                            file_path: path.to_string_lossy().to_string(),
                            version: None,
                            author: None,
                            installed: true,
                            installed_at: Some(Utc::now()),
                            local_path: Some(path.to_string_lossy().to_string()),
                            checksum: Some(checksum),
                            security_score: Some(report.score),
                            security_issues: Some(
                                report.issues.iter()
                                    .map(|i| {
                                        let file_info = i.file_path.as_ref()
                                            .map(|f| format!("[{}] ", f))
                                            .unwrap_or_default();
                                        format!("{}{:?}: {}", file_info, i.severity, i.description)
                                    })
                                    .collect()
                            ),
                            security_level: Some(match report.level {
                                crate::models::security::SecurityLevel::Safe => "Safe".to_string(),
                                crate::models::security::SecurityLevel::Low => "Low".to_string(),
                                crate::models::security::SecurityLevel::Medium => "Medium".to_string(),
                                crate::models::security::SecurityLevel::High => "High".to_string(),
                                crate::models::security::SecurityLevel::Critical => "Critical".to_string(),
                            }),
                            scanned_at: Some(Utc::now()),
                        };

                        // 保存到数据库
                        self.db.save_skill(&skill)?;
                        imported_skills.push(skill.clone());
                        scanned_skills.push(skill);

                        log::info!("Imported local skill: {:?}", path);
                    }
                    Err(e) => {
                        log::warn!("Failed to read skill file {:?}: {}", skill_md_path, e);
                    }
                }
            }
            }
        }

        log::info!("Scanned {} local skills, imported {} new skills",
                   scanned_skills.len(), imported_skills.len());
        Ok(scanned_skills)
    }

    /// 解析 SKILL.md 的 frontmatter
    fn parse_frontmatter(&self, content: &str) -> Result<(String, Option<String>)> {
        let lines: Vec<&str> = content.lines().collect();

        if lines.is_empty() || lines[0] != "---" {
            anyhow::bail!("Invalid SKILL.md format: missing frontmatter");
        }

        // 找到第二个 "---"
        let end_index = lines.iter()
            .skip(1)
            .position(|&line| line == "---")
            .context("Invalid SKILL.md format: frontmatter not closed")?;

        // 提取 frontmatter 内容
        let frontmatter_lines = &lines[1..=end_index];
        let _frontmatter_str = frontmatter_lines.join("\n");

        // 简单的 YAML 解析（只提取 name 和 description）
        let mut name = String::new();
        let mut description: Option<String> = None;

        for line in frontmatter_lines {
            if let Some(stripped) = line.strip_prefix("name:") {
                name = stripped.trim().to_string();
            } else if let Some(stripped) = line.strip_prefix("description:") {
                description = Some(stripped.trim().to_string());
            }
        }

        if name.is_empty() {
            anyhow::bail!("Missing 'name' field in frontmatter");
        }

        Ok((name, description))
    }
}
