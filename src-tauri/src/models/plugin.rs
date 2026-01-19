use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Claude Code Plugin 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub repository_url: String,
    pub repository_owner: Option<String>,
    pub marketplace_name: String,
    pub source: String,
    pub installed: bool,
    pub installed_at: Option<DateTime<Utc>>,
    pub security_score: Option<i32>,
    pub security_issues: Option<Vec<String>>,
    pub security_level: Option<String>,
    pub scanned_at: Option<DateTime<Utc>>,
    pub staging_path: Option<String>,
    pub install_log: Option<String>,
    pub install_status: Option<String>,
}

impl Plugin {
    pub fn new(
        name: String,
        repository_url: String,
        marketplace_name: String,
        source: String,
    ) -> Self {
        let repository_owner = Self::parse_repository_owner(&repository_url);
        let id = format!("{}::{}::{}", repository_url, marketplace_name, name);

        Self {
            id,
            name,
            description: None,
            version: None,
            author: None,
            repository_url,
            repository_owner: Some(repository_owner),
            marketplace_name,
            source,
            installed: false,
            installed_at: None,
            security_score: None,
            security_issues: None,
            security_level: None,
            scanned_at: None,
            staging_path: None,
            install_log: None,
            install_status: None,
        }
    }

    pub fn plugin_spec(&self) -> String {
        format!("{}@{}", self.name, self.marketplace_name)
    }

    fn parse_repository_owner(repository_url: &str) -> String {
        if repository_url == "local" {
            return "local".to_string();
        }

        if let Some(start) = repository_url.find("github.com/") {
            let after_github = &repository_url[start + 11..];
            if let Some(slash_pos) = after_github.find('/') {
                return after_github[..slash_pos].to_string();
            }
        }

        "unknown".to_string()
    }
}
