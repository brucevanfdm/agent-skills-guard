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
                    // 获取 skill 的元数据（name 和 description）
                    let (name, description) = match self.fetch_skill_metadata(&owner, &repo_name, &item.path).await {
                        Ok(metadata) => metadata,
                        Err(e) => {
                            log::warn!("Failed to fetch metadata for {}: {}, using fallback", item.path, e);
                            (item.name.clone(), None)
                        }
                    };

                    let mut skill = Skill::new(
                        name,
                        repo.url.clone(),
                        item.path.clone(),
                    );
                    skill.description = description;
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
                        // 获取 skill 的元数据（name 和 description）
                        let (name, description) = match self.fetch_skill_metadata(owner, repo, &item.path).await {
                            Ok(metadata) => metadata,
                            Err(e) => {
                                log::warn!("Failed to fetch metadata for {}: {}, using fallback", item.path, e);
                                (item.name.clone(), None)
                            }
                        };

                        let mut skill = Skill::new(
                            name,
                            repo_url.to_string(),
                            item.path.clone(),
                        );
                        skill.description = description;
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
            .context("网络请求失败，请检查您的网络连接")?;

        let status = response.status();

        // 处理不同的 HTTP 错误
        if !status.is_success() {
            match status.as_u16() {
                403 => {
                    // 检查是否是 API 限流
                    if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
                        if remaining == "0" {
                            if let Some(reset) = response.headers().get("x-ratelimit-reset") {
                                // 将 Unix 时间戳转换为可读格式
                                if let Ok(reset_str) = reset.to_str() {
                                    if let Ok(reset_timestamp) = reset_str.parse::<i64>() {
                                        let now = std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs() as i64;
                                        let wait_seconds = reset_timestamp - now;

                                        if wait_seconds > 0 {
                                            let wait_minutes = (wait_seconds + 59) / 60; // 向上取整
                                            anyhow::bail!(
                                                "GitHub API 速率限制已达上限，请等待约 {} 分钟后重试。\n\n提示：未认证的请求限制为每小时60次，认证后可提升至5000次/小时。",
                                                wait_minutes
                                            );
                                        }
                                    }
                                }
                            }
                            anyhow::bail!("GitHub API 速率限制已达上限，请稍后重试（约1小时后）");
                        }
                    }
                    anyhow::bail!("无权限访问该仓库，请检查仓库是否为私有仓库");
                }
                404 => {
                    anyhow::bail!("仓库或路径不存在: {}/{}", owner, repo);
                }
                401 => {
                    anyhow::bail!("未授权访问，请配置 GitHub Token");
                }
                500..=599 => {
                    anyhow::bail!("GitHub 服务器错误，请稍后重试");
                }
                _ => {
                    anyhow::bail!("GitHub API 返回错误: {}", status);
                }
            }
        }

        let contents: Vec<GitHubContent> = response
            .json()
            .await
            .context("解析 GitHub 响应失败，数据格式可能不正确")?;

        Ok(contents)
    }

    /// 下载文件内容
    pub async fn download_file(&self, download_url: &str) -> Result<Vec<u8>> {
        let response = self.client
            .get(download_url)
            .send()
            .await
            .context("网络请求失败，无法下载文件")?;

        let status = response.status();

        if !status.is_success() {
            match status.as_u16() {
                403 => {
                    if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
                        if remaining == "0" {
                            anyhow::bail!("GitHub API 速率限制已达上限，请稍后重试");
                        }
                    }
                    anyhow::bail!("无权限访问该文件");
                }
                404 => {
                    anyhow::bail!("文件不存在: {}", download_url);
                }
                _ => {
                    anyhow::bail!("下载文件失败: {}", status);
                }
            }
        }

        let bytes = response
            .bytes()
            .await
            .context("读取文件内容失败")?;

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

    /// 获取目录下的所有文件（不递归）
    pub async fn get_directory_files(&self, owner: &str, repo: &str, path: &str) -> Result<Vec<GitHubContent>> {
        let contents = self.fetch_directory_contents(owner, repo, path).await?;

        // 只返回文件，过滤掉子目录
        let files: Vec<GitHubContent> = contents.into_iter()
            .filter(|item| item.content_type == "file")
            .collect();

        Ok(files)
    }
}

impl Default for GitHubService {
    fn default() -> Self {
        Self::new()
    }
}
