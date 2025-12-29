use crate::models::{GitHubContent, Repository, Skill};
use anyhow::{Result, Context};
use reqwest::Client;
use serde::Deserialize;
use std::future::Future;
use std::pin::Pin;

/// SKILL.md 文件的 frontmatter
#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: String,
    description: Option<String>,
}

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
            if item.content_type == "dir" {
                // 检查文件夹是否为 skill（包含 SKILL.md）
                if self.is_skill_directory(&owner, &repo_name, &item.path).await? {
                    let skill = Skill::new(
                        item.name.clone(),
                        repo.url.clone(),
                        item.path.clone(),
                    );
                    skills.push(skill);
                } else if repo.scan_subdirs {
                    // 递归扫描子目录
                    match self.scan_directory(&owner, &repo_name, &item.path, &repo.url).await {
                        Ok(mut sub_skills) => skills.append(&mut sub_skills),
                        Err(e) => log::warn!("Failed to scan subdirectory {}: {}", item.path, e),
                    }
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
                if item.content_type == "dir" {
                    // 检查文件夹是否为 skill（包含 SKILL.md）
                    if self.is_skill_directory(owner, repo, &item.path).await? {
                        let skill = Skill::new(
                            item.name.clone(),
                            repo_url.to_string(),
                            item.path.clone(),
                        );
                        skills.push(skill);
                    } else if path.split('/').count() < 5 {
                        // 递归扫描（限制深度避免无限递归）
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

    /// 判断文件夹是否为 skill（包含 SKILL.md）
    async fn is_skill_directory(&self, owner: &str, repo: &str, path: &str) -> Result<bool> {
        // 获取文件夹内容
        match self.fetch_directory_contents(owner, repo, path).await {
            Ok(contents) => {
                // 检查是否包含 SKILL.md 文件
                Ok(contents.iter().any(|item| {
                    item.content_type == "file" && item.name.to_uppercase() == "SKILL.MD"
                }))
            }
            Err(e) => {
                log::warn!("Failed to check directory {}: {}", path, e);
                Ok(false)
            }
        }
    }

    /// 下载并解析 SKILL.md 的 frontmatter
    pub async fn fetch_skill_metadata(&self, owner: &str, repo: &str, skill_path: &str) -> Result<(String, Option<String>)> {
        // 构建 SKILL.md 的下载 URL
        let download_url = format!(
            "https://raw.githubusercontent.com/{}/{}/main/{}/SKILL.md",
            owner, repo, skill_path
        );

        log::info!("Fetching SKILL.md from: {}", download_url);

        // 下载文件内容
        let content = self.download_file(&download_url).await?;
        let content_str = String::from_utf8(content)
            .context("Failed to decode SKILL.md as UTF-8")?;

        // 解析 frontmatter
        self.parse_skill_frontmatter(&content_str)
    }

    /// 解析 SKILL.md 的 frontmatter
    fn parse_skill_frontmatter(&self, content: &str) -> Result<(String, Option<String>)> {
        // 查找 frontmatter 的边界（--- ... ---）
        let lines: Vec<&str> = content.lines().collect();

        if lines.is_empty() || lines[0] != "---" {
            anyhow::bail!("Invalid SKILL.md format: missing frontmatter");
        }

        // 找到第二个 "---"
        let end_index = lines.iter()
            .skip(1)
            .position(|&line| line == "---")
            .context("Invalid SKILL.md format: frontmatter not closed")?;

        // 提取 frontmatter 内容（跳过第一个 "---"）
        let frontmatter_lines = &lines[1..=end_index];
        let frontmatter_str = frontmatter_lines.join("\n");

        // 解析 YAML
        let frontmatter: SkillFrontmatter = serde_yaml::from_str(&frontmatter_str)
            .context("Failed to parse SKILL.md frontmatter as YAML")?;

        Ok((frontmatter.name, frontmatter.description))
    }
}

impl Default for GitHubService {
    fn default() -> Self {
        Self::new()
    }
}
