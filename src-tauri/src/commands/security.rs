use crate::commands::AppState;
use crate::models::security::{SecurityReport, SkillScanResult, SecurityLevel};
use crate::models::Skill;
use crate::security::SecurityScanner;
use anyhow::Result;
use std::path::PathBuf;
use tauri::State;

/// 扫描所有已安装的 skills
#[tauri::command]
pub async fn scan_all_installed_skills(
    state: State<'_, AppState>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = state.db.get_skills().map_err(|e| e.to_string())?;
    let installed_skills: Vec<Skill> = skills.into_iter()
        .filter(|s| s.installed && s.local_path.is_some())
        .collect();

    let scanner = SecurityScanner::new();
    let mut results = Vec::new();

    for mut skill in installed_skills {
        if let Some(local_path) = &skill.local_path {
            // local_path 是目录路径，需要拼接 SKILL.md 文件名
            let skill_file_path = PathBuf::from(local_path).join("SKILL.md");

            if let Ok(content) = std::fs::read_to_string(&skill_file_path) {
                match scanner.scan_file(&content, &skill.id) {
                    Ok(report) => {
                        // 更新 skill 的安全信息
                        skill.security_score = Some(report.score);
                        skill.security_level = Some(report.level.as_str().to_string());
                        skill.security_issues = Some(
                            report.issues.iter()
                                .map(|i| i.description.clone())
                                .collect()
                        );
                        skill.scanned_at = Some(chrono::Utc::now());

                        // 保存到数据库
                        if let Err(e) = state.db.save_skill(&skill) {
                            eprintln!("Failed to save skill {}: {}", skill.name, e);
                        }

                        results.push(SkillScanResult {
                            skill_id: skill.id.clone(),
                            skill_name: skill.name.clone(),
                            score: report.score,
                            level: report.level.as_str().to_string(),
                            scanned_at: chrono::Utc::now().to_rfc3339(),
                            report,
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to scan skill {}: {}", skill.name, e);
                    }
                }
            }
        }
    }

    Ok(results)
}

/// 获取缓存的扫描结果
#[tauri::command]
pub async fn get_scan_results(
    state: State<'_, AppState>,
) -> Result<Vec<SkillScanResult>, String> {
    use crate::models::security::{SecurityIssue, IssueSeverity, IssueCategory};

    let skills = state.db.get_skills().map_err(|e| e.to_string())?;

    let results: Vec<SkillScanResult> = skills.into_iter()
        .filter(|s| s.installed && s.security_score.is_some())
        .map(|s| {
            // 解析 security_issues 字符串为 SecurityIssue 对象
            let issues = if let Some(issue_strings) = &s.security_issues {
                issue_strings.iter().filter_map(|issue_str| {
                    // 解析格式: "Severity: description"
                    let parts: Vec<&str> = issue_str.splitn(2, ": ").collect();
                    if parts.len() == 2 {
                        let severity = match parts[0] {
                            "Critical" => IssueSeverity::Critical,
                            "Error" => IssueSeverity::Error,
                            "Warning" => IssueSeverity::Warning,
                            _ => IssueSeverity::Info,
                        };
                        Some(SecurityIssue {
                            severity,
                            category: IssueCategory::Other,
                            description: parts[1].to_string(),
                            line_number: None,
                            code_snippet: None,
                        })
                    } else {
                        None
                    }
                }).collect()
            } else {
                vec![]
            };

            let report = SecurityReport {
                skill_id: s.id.clone(),
                score: s.security_score.unwrap_or(0),
                level: SecurityLevel::from_score(s.security_score.unwrap_or(0)),
                issues,
                recommendations: vec![], // 建议信息暂时为空，未来可以存储到数据库
                blocked: false,
                hard_trigger_issues: vec![],
            };

            SkillScanResult {
                skill_id: s.id.clone(),
                skill_name: s.name.clone(),
                score: s.security_score.unwrap_or(0),
                level: s.security_level.clone().unwrap_or_else(|| "Unknown".to_string()),
                scanned_at: s.scanned_at.map(|d| d.to_rfc3339()).unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                report,
            }
        })
        .collect();

    Ok(results)
}

/// 扫描单个 skill 文件（用于安装前检查）
///
/// # 参数
///
/// * `archive_path` - skill 文件的路径（可以是压缩包内的 SKILL.md，或已解压的文件路径）
///
/// # 返回
///
/// 返回包含安全评分、等级和问题列表的 SecurityReport
#[tauri::command]
pub async fn scan_skill_archive(
    archive_path: String,
) -> Result<SecurityReport, String> {
    let scanner = SecurityScanner::new();

    // 验证文件存在性
    let path = std::path::Path::new(&archive_path);
    if !path.exists() {
        return Err(format!("Skill file not found: {}", archive_path));
    }
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", archive_path));
    }

    // 读取文件内容
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read skill file '{}': {}", archive_path, e))?;

    let report = scanner.scan_file(&content, &archive_path)
        .map_err(|e| format!("Failed to scan skill '{}': {}", archive_path, e))?;

    Ok(report)
}
