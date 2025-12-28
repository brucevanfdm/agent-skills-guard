mod scanner;
mod rules;

pub use scanner::SecurityScanner;
pub use rules::SecurityRules;

use crate::models::security::*;
use anyhow::Result;

/// 安全检查器特征
pub trait SecurityChecker {
    fn scan_file(&self, content: &str, file_path: &str) -> Result<SecurityReport>;
    fn calculate_score(&self, issues: &[SecurityIssue]) -> i32;
}
