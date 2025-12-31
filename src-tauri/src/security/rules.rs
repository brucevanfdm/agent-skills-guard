use regex::Regex;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

/// 风险严重程度
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

/// 风险类别
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Category {
    Destructive,      // 破坏性操作
    RemoteExec,       // 远程执行
    CmdInjection,     // 命令注入
    Network,          // 网络外传
    Privilege,        // 权限提升
    Secrets,          // 敏感泄露
    Persistence,      // 持久化
}

/// 置信度等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Confidence {
    High,    // 高置信度，误报可能性低
    Medium,  // 中等置信度
    Low,     // 低置信度，可能误报
}

/// 危险模式规则
#[derive(Debug, Clone)]
pub struct PatternRule {
    pub id: &'static str,
    pub name: &'static str,
    pub pattern: Regex,
    pub severity: Severity,
    pub category: Category,
    pub weight: i32,
    pub description: &'static str,
    pub hard_trigger: bool,
    pub confidence: Confidence,           // 新增
    pub remediation: &'static str,        // 新增：修复建议
    pub cwe_id: Option<&'static str>,     // 新增：CWE 编号
}

impl PatternRule {
    fn new(
        id: &'static str,
        name: &'static str,
        pattern: &'static str,
        severity: Severity,
        category: Category,
        weight: i32,
        description: &'static str,
        hard_trigger: bool,
        confidence: Confidence,           // 新增
        remediation: &'static str,        // 新增
        cwe_id: Option<&'static str>,     // 新增
    ) -> Self {
        Self {
            id,
            name,
            pattern: Regex::new(pattern).expect("Invalid regex pattern"),
            severity,
            category,
            weight,
            description,
            hard_trigger,
            confidence,      // 新增
            remediation,     // 新增
            cwe_id,          // 新增
        }
    }
}

lazy_static! {
    /// 所有危险模式规则库
    pub static ref PATTERN_RULES: Vec<PatternRule> = vec![
        // A. 破坏性操作
        PatternRule::new(
            "RM_RF_ROOT",
            "删除根目录",
            r"rm\s+(-[a-zA-Z]*)*\s*-r[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*/($|\s|;|\|)",
            Severity::Critical,
            Category::Destructive,
            100,
            "rm -rf / 删除根目录",
            true,
        ),
        PatternRule::new(
            "RM_RF_HOME",
            "删除用户目录",
            r"rm\s+(-[a-zA-Z]*)*\s*-r[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*(~|\$HOME)",
            Severity::Critical,
            Category::Destructive,
            90,
            "rm -rf ~ 删除用户目录",
            true,
        ),
        PatternRule::new(
            "DD_WIPE",
            "磁盘擦除",
            r"dd\s+.*of=/dev/(sd[a-z]|nvme|hd[a-z]|vd[a-z])",
            Severity::Critical,
            Category::Destructive,
            100,
            "dd 写入磁盘设备",
            true,
        ),
        PatternRule::new(
            "MKFS_FORMAT",
            "格式化磁盘",
            r"mkfs(\.[a-z0-9]+)?\s+/dev/",
            Severity::Critical,
            Category::Destructive,
            100,
            "mkfs 格式化命令",
            true,
        ),

        // B. 远程执行
        PatternRule::new(
            "CURL_PIPE_SH",
            "Curl管道执行",
            r"curl\s+[^|]*\|\s*(ba)?sh",
            Severity::Critical,
            Category::RemoteExec,
            90,
            "curl | sh 远程执行",
            true,
        ),
        PatternRule::new(
            "WGET_PIPE_SH",
            "Wget管道执行",
            r"wget\s+[^|]*\|\s*(ba)?sh",
            Severity::Critical,
            Category::RemoteExec,
            90,
            "wget | sh 远程执行",
            true,
        ),
        PatternRule::new(
            "BASE64_EXEC",
            "Base64解码执行",
            r"base64\s+(-d|--decode)[^|]*\|\s*(ba)?sh",
            Severity::Critical,
            Category::RemoteExec,
            85,
            "base64 解码后执行",
            true,
        ),
        PatternRule::new(
            "REVERSE_SHELL",
            "反弹Shell",
            r"(socket\.socket|s\.connect|os\.dup2|subprocess\.call.*bin/(ba)?sh)",
            Severity::Critical,
            Category::RemoteExec,
            95,
            "反弹Shell后门",
            true,
        ),

        // C. 命令注入
        PatternRule::new(
            "PY_EVAL",
            "Python eval",
            r"\beval\s*\(",
            Severity::High,
            Category::CmdInjection,
            70,
            "eval() 动态执行",
            false,
        ),
        PatternRule::new(
            "PY_EXEC",
            "Python exec",
            r"\bexec\s*\(",
            Severity::High,
            Category::CmdInjection,
            70,
            "exec() 动态执行",
            false,
        ),
        PatternRule::new(
            "OS_SYSTEM",
            "os.system",
            r"os\.system\s*\(",
            Severity::High,
            Category::CmdInjection,
            65,
            "os.system() Shell执行",
            false,
        ),
        PatternRule::new(
            "SUBPROCESS_SHELL",
            "subprocess shell=True",
            r"subprocess\.(run|call|Popen)\s*\([^)]*shell\s*=\s*True",
            Severity::High,
            Category::CmdInjection,
            65,
            "subprocess shell=True",
            false,
        ),
        PatternRule::new(
            "SUBPROCESS_CALL",
            "subprocess 调用",
            r"subprocess\.(run|call|Popen)\s*\(",
            Severity::Medium,
            Category::CmdInjection,
            25,
            "subprocess 进程调用",
            false,
        ),

        // D. 网络外传
        PatternRule::new(
            "CURL_POST",
            "Curl POST",
            r"curl\s+[^;|]*-X\s*POST",
            Severity::Medium,
            Category::Network,
            40,
            "curl POST 请求",
            false,
        ),
        PatternRule::new(
            "NETCAT",
            "Netcat连接",
            r"\bnc\s+(-[a-z]*\s+)*[a-zA-Z0-9.-]+\s+\d+",
            Severity::High,
            Category::Network,
            60,
            "netcat 网络连接",
            false,
        ),
        PatternRule::new(
            "PY_URLLIB",
            "Python urllib",
            r"urllib\.request\.urlopen\s*\(",
            Severity::Medium,
            Category::Network,
            35,
            "urllib 网络请求",
            false,
        ),
        PatternRule::new(
            "HTTP_REQUEST",
            "HTTP 请求库",
            r"requests\.(get|post|put|delete|patch)\s*\(",
            Severity::Low,
            Category::Network,
            15,
            "Python requests HTTP 请求",
            false,
        ),

        // E. 权限提升
        PatternRule::new(
            "SUDO",
            "sudo提权",
            r"\bsudo\s+",
            Severity::High,
            Category::Privilege,
            60,
            "sudo 权限提升",
            false,
        ),
        PatternRule::new(
            "CHMOD_777",
            "chmod 777",
            r"chmod\s+(-[a-zA-Z]*\s+)*7[0-7]{2}",
            Severity::High,
            Category::Privilege,
            55,
            "chmod 777 开放权限",
            false,
        ),
        PatternRule::new(
            "SUDOERS",
            "sudoers修改",
            r"(/etc/sudoers|visudo|NOPASSWD)",
            Severity::Critical,
            Category::Privilege,
            95,
            "sudoers 文件修改",
            true,
        ),

        // F. 持久化
        PatternRule::new(
            "CRONTAB",
            "Crontab持久化",
            r"(crontab\s+-|/etc/cron)",
            Severity::High,
            Category::Persistence,
            65,
            "crontab 持久化",
            false,
        ),
        PatternRule::new(
            "SSH_KEYS",
            "SSH密钥注入",
            r"(>>|>)\s*~?/?(\.ssh/authorized_keys|\.ssh/id_)",
            Severity::Critical,
            Category::Persistence,
            90,
            "SSH 密钥写入",
            true,
        ),

        // G. 敏感泄露
        PatternRule::new(
            "PRIVATE_KEY",
            "私钥硬编码",
            r"-----BEGIN\s+(RSA|OPENSSH|EC|DSA)?\s*PRIVATE KEY-----",
            Severity::High,
            Category::Secrets,
            70,
            "硬编码私钥",
            false,
        ),
        PatternRule::new(
            "API_KEY",
            "API Key",
            r#"(api[_-]?key|apikey|api_secret)\s*[=:]\s*["'][a-zA-Z0-9_-]{16,}["']"#,
            Severity::High,
            Category::Secrets,
            60,
            "硬编码 API Key",
            false,
        ),
        PatternRule::new(
            "PASSWORD",
            "密码硬编码",
            r#"(password|passwd|pwd)\s*[=:]\s*["'][^"']{4,}["']"#,
            Severity::High,
            Category::Secrets,
            55,
            "硬编码密码",
            false,
        ),
        PatternRule::new(
            "AWS_KEY",
            "AWS密钥",
            r"(AKIA|ASIA)[A-Z0-9]{16}",
            Severity::Critical,
            Category::Secrets,
            80,
            "AWS Access Key",
            false,
        ),
        PatternRule::new(
            "GITHUB_TOKEN",
            "GitHub Token",
            r"ghp_[a-zA-Z0-9]{36}",
            Severity::Critical,
            Category::Secrets,
            80,
            "GitHub Token",
            false,
        ),
    ];

    /// 仅获取硬触发规则
    pub static ref HARD_TRIGGER_RULES: Vec<&'static PatternRule> = {
        PATTERN_RULES.iter().filter(|r| r.hard_trigger).collect()
    };
}

pub struct SecurityRules;

impl SecurityRules {
    /// 获取所有模式规则
    pub fn get_all_patterns() -> &'static Vec<PatternRule> {
        &PATTERN_RULES
    }

    /// 获取所有硬触发规则
    pub fn get_hard_triggers() -> Vec<&'static PatternRule> {
        PATTERN_RULES.iter().filter(|r| r.hard_trigger).collect()
    }
}
