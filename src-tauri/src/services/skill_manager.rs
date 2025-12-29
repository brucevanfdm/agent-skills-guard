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
        let download_url = format!(
            "https://raw.githubusercontent.com/{}/{}/main/{}",
            owner, repo, skill.file_path
        );

        log::info!("Downloading skill from: {}", download_url);

        // 下载文件内容
        let content = self.github.download_file(&download_url).await?;

        // 安全扫描
        let content_str = String::from_utf8_lossy(&content);
        let report = self.scanner.scan_file(&content_str, &skill.file_path)?;

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

        // 写入文件
        let file_name = PathBuf::from(&skill.file_path)
            .file_name()
            .context("Invalid file path")?
            .to_str()
            .context("Invalid filename")?
            .to_string();

        let target_path = self.skills_dir.join(&file_name);

        std::fs::write(&target_path, content)
            .context("Failed to write skill file")?;

        // 更新数据库
        skill.installed = true;
        skill.installed_at = Some(Utc::now());
        skill.local_path = Some(target_path.to_string_lossy().to_string());

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
