use crate::models::security::*;
use crate::security::SecurityRules;
use anyhow::Result;
use sha2::{Sha256, Digest};

pub struct SecurityScanner;

impl SecurityScanner {
    pub fn new() -> Self {
        Self
    }

    /// 扫描文件内容，生成安全报告
    pub fn scan_file(&self, content: &str, file_path: &str) -> Result<SecurityReport> {
        let mut issues = Vec::new();
        let skill_id = file_path.to_string();

        // 逐行扫描代码
        for (line_num, line) in content.lines().enumerate() {
            let findings = SecurityRules::check_line(line);

            for (description, category_str) in findings {
                let category = match category_str.as_str() {
                    "FileSystem" => IssueCategory::FileSystem,
                    "Network" => IssueCategory::Network,
                    "DataExfiltration" => IssueCategory::DataExfiltration,
                    "FileOperation" => IssueCategory::FileSystem,
                    "Obfuscation" => IssueCategory::ObfuscatedCode,
                    _ => IssueCategory::Other,
                };

                let severity = self.determine_severity(&category);

                issues.push(SecurityIssue {
                    severity,
                    category,
                    description,
                    line_number: Some(line_num + 1),
                    code_snippet: Some(line.to_string()),
                });
            }
        }

        // 计算安全评分
        let score = self.calculate_score(&issues);
        let level = SecurityLevel::from_score(score);

        // 生成建议
        let recommendations = self.generate_recommendations(&issues, score);

        Ok(SecurityReport {
            skill_id,
            score,
            level,
            issues,
            recommendations,
        })
    }

    /// 计算安全评分（0-100分）
    pub fn calculate_score(&self, issues: &[SecurityIssue]) -> i32 {
        let mut base_score = 100;

        for issue in issues {
            let deduction = match issue.severity {
                IssueSeverity::Critical => 30,
                IssueSeverity::Error => 20,
                IssueSeverity::Warning => 10,
                IssueSeverity::Info => 5,
            };
            base_score -= deduction;
        }

        base_score.max(0)
    }

    /// 计算文件校验和
    pub fn calculate_checksum(&self, content: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content);
        format!("{:x}", hasher.finalize())
    }

    /// 确定问题严重程度
    fn determine_severity(&self, category: &IssueCategory) -> IssueSeverity {
        match category {
            IssueCategory::ProcessExecution => IssueSeverity::Critical,
            IssueCategory::DataExfiltration => IssueSeverity::Critical,
            IssueCategory::Network => IssueSeverity::Error,
            IssueCategory::FileSystem => IssueSeverity::Warning,
            IssueCategory::DangerousFunction => IssueSeverity::Error,
            IssueCategory::ObfuscatedCode => IssueSeverity::Warning,
            _ => IssueSeverity::Info,
        }
    }

    /// 生成安全建议
    fn generate_recommendations(&self, issues: &[SecurityIssue], score: i32) -> Vec<String> {
        let mut recommendations = Vec::new();

        if score < 50 {
            recommendations.push("⚠️ 此 skill 存在严重安全风险，建议不要安装".to_string());
        } else if score < 70 {
            recommendations.push("⚠️ 此 skill 存在中等安全风险，请谨慎使用".to_string());
        }

        // 按类别提供建议
        let has_network = issues.iter().any(|i| matches!(i.category, IssueCategory::Network));
        let has_filesystem = issues.iter().any(|i| matches!(i.category, IssueCategory::FileSystem));
        let has_process = issues.iter().any(|i| matches!(i.category, IssueCategory::ProcessExecution));

        if has_network {
            recommendations.push("包含网络请求操作，请确认目标地址可信".to_string());
        }

        if has_filesystem {
            recommendations.push("包含文件系统操作，请检查操作的文件路径".to_string());
        }

        if has_process {
            recommendations.push("包含进程执行操作，存在高风险".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("✅ 未发现明显安全问题".to_string());
        }

        recommendations
    }
}

impl Default for SecurityScanner {
    fn default() -> Self {
        Self::new()
    }
}
