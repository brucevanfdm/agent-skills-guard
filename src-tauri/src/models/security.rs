use serde::{Deserialize, Serialize};

/// 安全检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityReport {
    pub skill_id: String,
    pub score: i32,
    pub level: SecurityLevel,
    pub issues: Vec<SecurityIssue>,
    pub recommendations: Vec<String>,
}

/// 安全等级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SecurityLevel {
    Safe,       // 90-100分
    Low,        // 70-89分
    Medium,     // 50-69分
    High,       // 30-49分
    Critical,   // 0-29分
}

impl SecurityLevel {
    pub fn from_score(score: i32) -> Self {
        match score {
            90..=100 => SecurityLevel::Safe,
            70..=89 => SecurityLevel::Low,
            50..=69 => SecurityLevel::Medium,
            30..=49 => SecurityLevel::High,
            _ => SecurityLevel::Critical,
        }
    }
}

/// 安全问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityIssue {
    pub severity: IssueSeverity,
    pub category: IssueCategory,
    pub description: String,
    pub line_number: Option<usize>,
    pub code_snippet: Option<String>,
}

/// 问题严重程度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

/// 问题分类
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueCategory {
    FileSystem,         // 文件系统操作
    Network,            // 网络请求
    ProcessExecution,   // 进程执行
    DataExfiltration,   // 数据泄露风险
    DangerousFunction,  // 危险函数调用
    ObfuscatedCode,     // 代码混淆
    Other,
}
