use crate::commands::AppState;
use crate::models::security::{SecurityReport, SkillScanResult, SecurityLevel};
use crate::models::Skill;
use crate::security::SecurityScanner;
use crate::i18n::validate_locale;
use anyhow::Result;
use rust_i18n::t;
use std::path::PathBuf;
use tauri::State;

/// 扫描所有已安装的 skills
#[tauri::command]
pub async fn scan_all_installed_skills(
    state: State<'_, AppState>,
    locale: String,
) -> Result<Vec<SkillScanResult>, String> {
    let locale = validate_locale(&locale);
    let skills = state.db.get_skills().map_err(|e| e.to_string())?;
    let installed_skills: Vec<Skill> = skills.into_iter()
        .filter(|s| s.installed && s.local_path.is_some())
        .collect();

    let scanner = SecurityScanner::new();
    let mut results = Vec::new();

    for mut skill in installed_skills {
        if let Some(local_path) = &skill.local_path {
            // local_path 是目录路径，扫描整个目录
            let path = PathBuf::from(local_path);

            // 检查目录是否存在
            if !path.exists() || !path.is_dir() {
                eprintln!("Skill directory does not exist: {:?}", path);
                continue;
            }

            match scanner.scan_directory(
                path.to_str().unwrap_or(""),
                &skill.id,
                &locale
            ) {
                Ok(report) => {
                    // 更新 skill 的安全信息
                    skill.security_score = Some(report.score);
                    skill.security_level = Some(report.level.as_str().to_string());
                    skill.security_issues = Some(
                        report.issues.iter()
                            .map(|i| {
                                let file_info = i.file_path.as_ref()
                                    .map(|f| format!("[{}] ", f))
                                    .unwrap_or_default();
                                format!("{}{:?}: {}", file_info, i.severity, i.description)
                            })
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

    Ok(results)
}

/// 扫描单个已安装 skill（用于前端展示扫描进度）
#[tauri::command]
pub async fn scan_installed_skill(
    state: State<'_, AppState>,
    skill_id: String,
    locale: String,
) -> Result<SkillScanResult, String> {
    let locale = validate_locale(&locale);
    let mut skill = state
        .db
        .get_skills()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.id == skill_id)
        .ok_or_else(|| "Skill not found".to_string())?;

    if !skill.installed || skill.local_path.is_none() {
        return Err("Skill is not installed".to_string());
    }

    let local_path = skill.local_path.clone().unwrap_or_default();
    let path = PathBuf::from(&local_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("Skill directory does not exist: {}", local_path));
    }

    let scanner = SecurityScanner::new();
    let report = scanner
        .scan_directory(path.to_str().unwrap_or(""), &skill.id, &locale)
        .map_err(|e| e.to_string())?;

    skill.security_score = Some(report.score);
    skill.security_level = Some(report.level.as_str().to_string());
    skill.security_issues = Some(
        report
            .issues
            .iter()
            .map(|i| {
                let file_info = i
                    .file_path
                    .as_ref()
                    .map(|f| format!("[{}] ", f))
                    .unwrap_or_default();
                format!("{}{:?}: {}", file_info, i.severity, i.description)
            })
            .collect(),
    );
    skill.scanned_at = Some(chrono::Utc::now());

    state
        .db
        .save_skill(&skill)
        .map_err(|e| format!("Failed to save skill: {}", e))?;

    Ok(SkillScanResult {
        skill_id: skill.id.clone(),
        skill_name: skill.name.clone(),
        score: report.score,
        level: report.level.as_str().to_string(),
        scanned_at: chrono::Utc::now().to_rfc3339(),
        report,
    })
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
                    // 解析格式: "[filename] Severity: description"
                    // 先提取文件路径
                    let (file_path, remaining) = if issue_str.starts_with('[') {
                        if let Some(end_bracket) = issue_str.find(']') {
                            let file = issue_str[1..end_bracket].to_string();
                            let rest = issue_str[end_bracket + 1..].trim();
                            (Some(file), rest)
                        } else {
                            (None, issue_str.as_str())
                        }
                    } else {
                        (None, issue_str.as_str())
                    };

                    // 然后解析 Severity: description
                    let parts: Vec<&str> = remaining.splitn(2, ": ").collect();
                    if parts.len() == 2 {
                        let severity = match parts[0] {
                            "Critical" => Some(IssueSeverity::Critical),
                            "Error" => Some(IssueSeverity::Error),
                            "Warning" => Some(IssueSeverity::Warning),
                            "Info" => Some(IssueSeverity::Info),
                            _ => None,
                        };

                        if let Some(severity) = severity {
                            Some(SecurityIssue {
                                severity,
                                category: IssueCategory::Other,
                                description: parts[1].to_string(),
                                line_number: None,
                                code_snippet: None,
                                file_path,
                            })
                        } else {
                            // 兼容旧格式（没有 Severity 前缀）：保留原始文本，避免丢失规则名等信息
                            Some(SecurityIssue {
                                severity: IssueSeverity::Info,
                                category: IssueCategory::Other,
                                description: remaining.to_string(),
                                line_number: None,
                                code_snippet: None,
                                file_path,
                            })
                        }
                    } else {
                        // 兼容无法解析的格式：保留原始文本
                        Some(SecurityIssue {
                            severity: IssueSeverity::Info,
                            category: IssueCategory::Other,
                            description: remaining.to_string(),
                            line_number: None,
                            code_snippet: None,
                            file_path,
                        })
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
                scanned_files: vec![], // 缓存结果中没有扫描文件列表
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
    locale: String,
) -> Result<SecurityReport, String> {
    let locale = validate_locale(&locale);
    let scanner = SecurityScanner::new();

    // 验证文件存在性
    let path = std::path::Path::new(&archive_path);
    if !path.exists() {
        return Err(t!("common.errors.file_not_found", locale = locale, path = &archive_path).to_string());
    }
    if !path.is_file() {
        return Err(t!("common.errors.path_not_file", locale = locale, path = &archive_path).to_string());
    }

    // 读取文件内容
    let content = std::fs::read_to_string(path)
        .map_err(|e| t!("common.errors.read_failed",
            locale = locale,
            path = &archive_path,
            error = e.to_string()
        ).to_string())?;

    let report = scanner.scan_file(&content, &archive_path, &locale)
        .map_err(|e| t!("common.errors.scan_failed",
            locale = locale,
            path = &archive_path,
            error = e.to_string()
        ).to_string())?;

    Ok(report)
}
