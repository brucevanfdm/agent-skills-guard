use anyhow::{Result, Context};
use reqwest::{Client, Proxy};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// SOCKS5 代理配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 是否启用代理
    pub enabled: bool,
    /// 代理服务器地址
    pub host: String,
    /// 代理服务器端口
    pub port: u16,
    /// 用户名（可选）
    pub username: Option<String>,
    /// 密码（可选）
    pub password: Option<String>,
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            host: String::new(),
            port: 1080,
            username: None,
            password: None,
        }
    }
}

impl ProxyConfig {
    /// 检查配置是否有效
    pub fn is_valid(&self) -> bool {
        !self.host.is_empty() && self.port > 0
    }

    /// 构建代理 URL
    pub fn to_proxy_url(&self) -> String {
        if let (Some(username), Some(password)) = (&self.username, &self.password) {
            if !username.is_empty() && !password.is_empty() {
                return format!("socks5h://{}:{}@{}:{}", username, password, self.host, self.port);
            }
        }
        format!("socks5h://{}:{}", self.host, self.port)
    }
}

/// 代理服务
pub struct ProxyService;

impl ProxyService {
    /// 根据代理配置构建 HTTP 客户端
    pub fn build_http_client(config: Option<&ProxyConfig>) -> Result<Client> {
        let mut builder = Client::builder()
            .user_agent("agent-skills-guard")
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10));

        if let Some(cfg) = config {
            if cfg.enabled && cfg.is_valid() {
                let proxy_url = cfg.to_proxy_url();
                log::info!("使用 SOCKS5 代理: {}:{}", cfg.host, cfg.port);
                let proxy = Proxy::all(&proxy_url)
                    .context("无法创建代理配置")?;
                builder = builder.proxy(proxy);
            }
        }

        builder.build().context("无法创建 HTTP 客户端")
    }

    /// 测试代理连接
    /// 通过代理访问 google.com 来验证代理是否可用
    pub async fn test_proxy(config: &ProxyConfig) -> Result<()> {
        if !config.is_valid() {
            anyhow::bail!("代理配置无效：主机或端口为空");
        }

        // 创建一个临时的带代理的客户端
        let proxy_url = config.to_proxy_url();
        let proxy = Proxy::all(&proxy_url)
            .context("无法创建代理配置")?;

        let client = Client::builder()
            .user_agent("agent-skills-guard")
            .timeout(Duration::from_secs(10))
            .connect_timeout(Duration::from_secs(5))
            .proxy(proxy)
            .build()
            .context("无法创建测试客户端")?;

        // 尝试通过代理访问 google.com
        log::info!("测试代理连接: {}:{}", config.host, config.port);
        
        let response = client
            .get("https://www.google.com")
            .send()
            .await
            .context("通过代理访问 google.com 失败")?;

        if response.status().is_success() || response.status().is_redirection() {
            log::info!("代理测试成功，状态码: {}", response.status());
            Ok(())
        } else {
            anyhow::bail!("代理测试失败，HTTP 状态码: {}", response.status())
        }
    }
}
