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

    /// 下载并分析 skill
    pub async fn download_and_analyze(&self, skill: &mut Skill) -> Result<Vec<u8>> {
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

        Ok(content)
    }

    /// 安装 skill 到本地
    pub async fn install_skill(&self, skill_id: &str) -> Result<()> {
        // 从数据库获取 skill
        let mut skill = self.db.get_skills()?
            .into_iter()
            .find(|s| s.id == skill_id)
            .context("Skill not found")?;

        // 下载并分析
        let content = self.download_and_analyze(&mut skill).await?;

        // 检查安全评分
        if let Some(score) = skill.security_score {
            if score < 50 {
                anyhow::bail!(
                    "Skill security score too low: {}. Installation blocked for safety.",
                    score
                );
            }
        }

        // 确保目标目录存在
        std::fs::create_dir_all(&self.skills_dir)
            .context("Failed to create skills directory")?;

        // 创建 skill 文件夹（使用 skill 的文件夹名）
        let skill_folder_name = PathBuf::from(&skill.file_path)
            .file_name()
            .context("Invalid skill path")?
            .to_str()
            .context("Invalid skill folder name")?
            .to_string();

        let skill_dir = self.skills_dir.join(&skill_folder_name);
        std::fs::create_dir_all(&skill_dir)
            .context("Failed to create skill directory")?;

        // 写入 SKILL.md 文件
        let skill_file_path = skill_dir.join("SKILL.md");
        std::fs::write(&skill_file_path, content)
            .context("Failed to write SKILL.md file")?;

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
            .context("Skill not found")?;

        // 删除本地文件
        if let Some(local_path) = &skill.local_path {
            let path = PathBuf::from(local_path);
            if path.exists() {
                std::fs::remove_file(&path)
                    .context("Failed to remove skill file")?;
            }
        }

        // 更新数据库
        skill.installed = false;
        skill.installed_at = None;
        skill.local_path = None;

        self.db.save_skill(&skill)?;

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
}
