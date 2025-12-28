use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Skill 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub repository_url: String,
    pub file_path: String,
    pub version: Option<String>,
    pub author: Option<String>,
    pub installed: bool,
    pub installed_at: Option<DateTime<Utc>>,
    pub local_path: Option<String>,
    pub checksum: Option<String>,
    pub security_score: Option<i32>,
    pub security_issues: Option<Vec<String>>,
}

impl Skill {
    pub fn new(
        name: String,
        repository_url: String,
        file_path: String,
    ) -> Self {
        Self {
            id: format!("{}::{}", repository_url, file_path),
            name,
            description: None,
            repository_url,
            file_path,
            version: None,
            author: None,
            installed: false,
            installed_at: None,
            local_path: None,
            checksum: None,
            security_score: None,
            security_issues: None,
        }
    }
}

/// Skill 安装状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SkillStatus {
    NotInstalled,
    Installing,
    Installed,
    Failed,
    UpdateAvailable,
}

/// Skill 安装记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstallation {
    pub skill_id: String,
    pub installed_at: DateTime<Utc>,
    pub version: String,
    pub local_path: String,
    pub checksum: String,
}
