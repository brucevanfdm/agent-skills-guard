use regex::Regex;
use lazy_static::lazy_static;

lazy_static! {
    /// 危险文件系统操作模式
    pub static ref DANGEROUS_FS_PATTERNS: Vec<(&'static str, &'static str)> = vec![
        (r"rm\s+-rf\s+/", "尝试删除根目录"),
        (r"rm\s+-rf\s+\$HOME", "尝试删除用户主目录"),
        (r"chmod\s+777", "设置过于宽松的文件权限"),
        (r"eval\s*\(", "使用危险的 eval 函数"),
        (r"exec\s*\(", "使用危险的 exec 函数"),
        (r"os\.system\s*\(", "使用系统命令执行"),
        (r"subprocess\.(call|run|Popen)", "执行子进程"),
    ];

    /// 网络相关危险操作
    pub static ref NETWORK_PATTERNS: Vec<(&'static str, &'static str)> = vec![
        (r"curl\s+.*\|\s*bash", "通过网络下载并执行脚本"),
        (r"wget\s+.*\|\s*sh", "通过网络下载并执行脚本"),
        (r"requests\.post\s*\(", "发送 HTTP POST 请求"),
        (r"http\.request\s*\(", "发送 HTTP 请求"),
        (r"socket\.connect\s*\(", "建立网络连接"),
    ];

    /// 数据泄露风险模式
    pub static ref DATA_EXFILTRATION_PATTERNS: Vec<(&'static str, &'static str)> = vec![
        (r"AWS_ACCESS_KEY", "可能包含 AWS 访问密钥"),
        (r"API_KEY", "可能包含 API 密钥"),
        (r"PASSWORD\s*=", "可能包含硬编码密码"),
        (r"SECRET\s*=", "可能包含硬编码密钥"),
        (r"/\.ssh/", "访问 SSH 密钥目录"),
        (r"/\.aws/", "访问 AWS 配置目录"),
    ];

    /// 文件读写操作
    pub static ref FILE_OPERATION_PATTERNS: Vec<(&'static str, &'static str)> = vec![
        (r"open\s*\(.*['\"]w", "文件写入操作"),
        (r"File\.write", "文件写入操作"),
        (r"fs\.writeFile", "文件写入操作"),
        (r"os\.remove", "文件删除操作"),
        (r"shutil\.rmtree", "目录删除操作"),
    ];

    /// 代码混淆特征
    pub static ref OBFUSCATION_PATTERNS: Vec<(&'static str, &'static str)> = vec![
        (r"base64\.b64decode", "Base64 解码（可能用于混淆）"),
        (r"\\x[0-9a-fA-F]{2}", "十六进制编码字符串"),
        (r"chr\s*\(\s*\d+\s*\)", "字符编码（可能用于混淆）"),
    ];
}

pub struct SecurityRules;

impl SecurityRules {
    /// 检查代码行是否包含危险模式
    pub fn check_line(line: &str) -> Vec<(String, String)> {
        let mut findings = Vec::new();

        // 检查所有危险模式
        for (pattern, description) in DANGEROUS_FS_PATTERNS.iter() {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(line) {
                    findings.push((description.to_string(), "FileSystem".to_string()));
                }
            }
        }

        for (pattern, description) in NETWORK_PATTERNS.iter() {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(line) {
                    findings.push((description.to_string(), "Network".to_string()));
                }
            }
        }

        for (pattern, description) in DATA_EXFILTRATION_PATTERNS.iter() {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(line) {
                    findings.push((description.to_string(), "DataExfiltration".to_string()));
                }
            }
        }

        for (pattern, description) in FILE_OPERATION_PATTERNS.iter() {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(line) {
                    findings.push((description.to_string(), "FileOperation".to_string()));
                }
            }
        }

        for (pattern, description) in OBFUSCATION_PATTERNS.iter() {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(line) {
                    findings.push((description.to_string(), "Obfuscation".to_string()));
                }
            }
        }

        findings
    }
}
