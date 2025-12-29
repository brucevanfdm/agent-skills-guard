use crate::models::{GitHubContent, Repository, Skill};
use anyhow::{Result, Context};
use reqwest::Client;
use std::future::Future;
use std::pin::Pin;

pub struct GitHubService {
    client: Client,
    api_base: String,
}

impl GitHubService {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("agent-skills-guard/0.1.0")
                .build()
                .unwrap(),
            api_base: "https://api.github.com".to_string(),
        }
    }

    /// 扫描仓库中的 skills
    pub async fn scan_repository(&self, repo: &Repository) -> Result<Vec<Skill>> {
        let (owner, repo_name) = Repository::from_github_url(&repo.url)?;
        let mut skills = Vec::new();

        // 获取仓库根目录内容
        let contents = self.fetch_directory_contents(&owner, &repo_name, "").await?;

        for item in contents {
            if item.content_type == "file" && self.is_skill_file(&item.name) {
                let skill = Skill::new(
                    item.name.clone(),
                    repo.url.clone(),
                    item.path.clone(),
                );
                skills.push(skill);
            } else if item.content_type == "dir" && repo.scan_subdirs {
                // 递归扫描子目录
                match self.scan_directory(&owner, &repo_name, &item.path, &repo.url).await {
                    Ok(mut sub_skills) => skills.append(&mut sub_skills),
                    Err(e) => log::warn!("Failed to scan subdirectory {}: {}", item.path, e),
                }
            }
        }

        Ok(skills)
    }

    /// 递归扫描目录
    fn scan_directory<'a>(
        &'a self,
        owner: &'a str,
        repo: &'a str,
        path: &'a str,
        repo_url: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<Skill>>> + Send + 'a>> {
        Box::pin(async move {
            let mut skills = Vec::new();
            let contents = self.fetch_directory_contents(owner, repo, path).await?;

            for item in contents {
                if item.content_type == "file" && self.is_skill_file(&item.name) {
                    let skill = Skill::new(
                        item.name.clone(),
                        repo_url.to_string(),
                        item.path.clone(),
                    );
                    skills.push(skill);
                } else if item.content_type == "dir" {
                    // 递归扫描（限制深度避免无限递归）
                    if path.split('/').count() < 5 {
                        match self.scan_directory(owner, repo, &item.path, repo_url).await {
                            Ok(mut sub_skills) => skills.append(&mut sub_skills),
                            Err(e) => log::warn!("Failed to scan subdirectory {}: {}", item.path, e),
                        }
                    }
                }
            }

            Ok(skills)
        })
    }

    /// 获取目录内容
    async fn fetch_directory_contents(
        &self,
        owner: &str,
        repo: &str,
        path: &str,
    ) -> Result<Vec<GitHubContent>> {
        let url = if path.is_empty() {
            format!("{}/repos/{}/{}/contents", self.api_base, owner, repo)
        } else {
            format!("{}/repos/{}/{}/contents/{}", self.api_base, owner, repo, path)
        };

        let response = self.client
            .get(&url)
            .send()
            .await
            .context("Failed to fetch GitHub directory")?;

        if !response.status().is_success() {
            anyhow::bail!("GitHub API returned error: {}", response.status());
        }

        let contents: Vec<GitHubContent> = response
            .json()
            .await
            .context("Failed to parse GitHub response")?;

        Ok(contents)
    }

    /// 下载文件内容
    pub async fn download_file(&self, download_url: &str) -> Result<Vec<u8>> {
        let response = self.client
            .get(download_url)
            .send()
            .await
            .context("Failed to download file")?;

        if !response.status().is_success() {
            anyhow::bail!("Failed to download file: {}", response.status());
        }

        let bytes = response
            .bytes()
            .await
            .context("Failed to read file bytes")?;

        Ok(bytes.to_vec())
    }

    /// 判断是否为 skill 文件
    fn is_skill_file(&self, filename: &str) -> bool {
        let lowercase = filename.to_lowercase();
        lowercase.ends_with(".py")
            || lowercase.ends_with(".js")
            || lowercase.ends_with(".ts")
            || lowercase.ends_with(".sh")
    }
}

impl Default for GitHubService {
    fn default() -> Self {
        Self::new()
    }
}
