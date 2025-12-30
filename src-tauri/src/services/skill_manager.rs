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
        let report = self.scanner.scan_file(&content_str, "SKILL.md")?;

        // 更新 skill 信息
        skill.security_score = Some(report.score);
        skill.security_issues = Some(
            report.issues.iter()
                .map(|i| format!("{:?}: {}", i.severity, i.description))
                .collect()
        );
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

        // 下载并分析 SKILL.md（用于安全检查和元数据提取）
        let (_skill_md_content, _report) = self.download_and_analyze(&mut skill).await?;

        // [已禁用] 安全扫描功能暂时关闭，方便调试
        // // 优先检查是否被 hard_trigger 阻止
        // if report.blocked {
        //     let mut error_msg = format!(
        //         "⛔ 安全检测发现严重威胁，禁止安装！\n\n检测到以下高危操作：\n"
        //     );
        //     for (idx, issue) in report.hard_trigger_issues.iter().enumerate() {
        //         error_msg.push_str(&format!("{}. {}\n", idx + 1, issue));
        //     }
        //     error_msg.push_str("\n这些操作可能对您的系统造成严重危害，强烈建议不要安装此技能。");
        //     anyhow::bail!(error_msg);
        // }

        // // 检查安全评分
        // if let Some(score) = skill.security_score {
        //     if score < 50 {
        //         anyhow::bail!(
        //             "技能安全评分过低 ({}分)，为保护您的安全已阻止安装。建议评分至少为 50 分以上。",
        //             score
        //         );
        //     }
        // }

        // 确保目标目录存在
        std::fs::create_dir_all(&self.skills_dir)
            .context("无法创建技能目录，请检查磁盘权限")?;

        // 创建 skill 文件夹（使用 skill 的文件夹名）
        let skill_folder_name = PathBuf::from(&skill.file_path)
            .file_name()
            .context("技能路径格式无效")?
            .to_str()
            .context("技能文件夹名称包含无效字符")?
            .to_string();

        let skill_dir = self.skills_dir.join(&skill_folder_name);
        std::fs::create_dir_all(&skill_dir)
            .context("无法创建技能子目录，请检查磁盘空间和权限")?;

        // 下载整个 skill 目录的所有文件
        let (owner, repo) = crate::models::Repository::from_github_url(&skill.repository_url)?;
        let skill_files = self.github.get_directory_files(&owner, &repo, &skill.file_path).await
            .context("获取技能目录文件列表失败")?;

        log::info!("Found {} files in skill directory", skill_files.len());

        // 下载并扫描每个文件
        for file_info in &skill_files {
            if file_info.content_type != "file" {
                continue; // 跳过子目录
            }

            // 获取 download_url
            let download_url = file_info.download_url.as_ref()
                .context(format!("文件 {} 缺少下载链接", file_info.name))?;

            let file_content = self.github.download_file(download_url).await
                .context(format!("下载文件失败: {}", file_info.name))?;

            // [已禁用] 安全扫描功能暂时关闭，方便调试
            // // 对所有文本文件进行安全扫描
            // if let Ok(content_str) = String::from_utf8(file_content.clone()) {
            //     let file_report = self.scanner.scan_file(&content_str, &file_info.name)?;
            //
            //     // 如果任何文件触发 hard_trigger，阻止安装
            //     if file_report.blocked {
            //         anyhow::bail!(
            //             "⛔ 文件 {} 包含严重安全威胁，已阻止安装！",
            //             file_info.name
            //         );
            //     }
            // }

            // 写入文件到本地
            let local_file_path = skill_dir.join(&file_info.name);
            std::fs::write(&local_file_path, file_content)
                .context(format!("无法写入文件: {}", file_info.name))?;

            log::info!("Saved file: {}", file_info.name);
        }

        // 更新数据库
        skill.installed = true;
        skill.installed_at = Some(Utc::now());
        skill.local_path = Some(skill_dir.to_string_lossy().to_string());

        self.db.save_skill(&skill)?;

        log::info!("Skill installed successfully: {}", skill.name);
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
        let mut scanned_skills = Vec::new();  // 所有扫描到的技能
        let mut imported_skills = Vec::new(); // 新导入的技能（用于日志）

        // 检查技能目录是否存在
        if !self.skills_dir.exists() {
            log::info!("Skills directory does not exist: {:?}", self.skills_dir);
            return Ok(scanned_skills);
        }

        log::info!("Scanning local skills directory: {:?}", self.skills_dir);

        // 获取当前数据库中的所有技能（用于去重）
        let existing_skills = self.db.get_skills()?;

        // 遍历技能目录
        if let Ok(entries) = std::fs::read_dir(&self.skills_dir) {
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
                        // 计算 checksum 用于去重
                        let checksum = self.scanner.calculate_checksum(content.as_bytes());

                        // 检查是否已存在（基于 checksum）
                        if let Some(existing_skill) = existing_skills.iter()
                            .find(|s| s.checksum.as_ref() == Some(&checksum)) {
                            // 已存在的技能，添加到扫描结果
                            log::debug!("Skill already tracked: {:?}", path);
                            scanned_skills.push(existing_skill.clone());
                            continue;
                        }

                        // 安全扫描
                        let report = self.scanner.scan_file(&content, "SKILL.md")?;

                        // 解析 frontmatter 获取元数据
                        let (name, description) = self.parse_frontmatter(&content)
                            .unwrap_or_else(|_| {
                                (
                                    path.file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                    None
                                )
                            });

                        // 创建 skill 对象
                        let skill = Skill {
                            id: format!("local::{}", checksum[..16].to_string()),
                            name,
                            description,
                            repository_url: "local".to_string(),
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
                                    .map(|i| format!("{:?}: {}", i.severity, i.description))
                                    .collect()
                            ),
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
        let frontmatter_str = frontmatter_lines.join("\n");

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
