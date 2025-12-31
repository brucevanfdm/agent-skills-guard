use crate::models::security::{SecurityReport, SkillScanResult, SecurityLevel};
use crate::models::Skill;
use crate::security::SecurityScanner;
use crate::services::database::Database;
use anyhow::Result;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

/// 扫描所有已安装的 skills
#[tauri::command]
pub async fn scan_all_installed_skills(
    db: State<'_, Arc<Database>>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = db.get_skills().map_err(|e| e.to_string())?;
    let installed_skills: Vec<Skill> = skills.into_iter()
        .filter(|s| s.installed && s.local_path.is_some())
        .collect();

    let scanner = SecurityScanner::new();
    let mut results = Vec::new();

    for mut skill in installed_skills {
        if let Some(local_path) = &skill.local_path {
            let skill_file_path = PathBuf::from(local_path);

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
                        let _ = db.save_skill(&skill);

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
    db: State<'_, Arc<Database>>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = db.get_skills().map_err(|e| e.to_string())?;

    let results: Vec<SkillScanResult> = skills.into_iter()
        .filter(|s| s.installed && s.security_score.is_some())
        .map(|s| {
            let report = SecurityReport {
                skill_id: s.id.clone(),
                score: s.security_score.unwrap_or(0),
                level: SecurityLevel::from_score(s.security_score.unwrap_or(0)),
                issues: vec![], // 从数据库恢复 issues 需要反序列化
                recommendations: vec![],
                blocked: false,
                hard_trigger_issues: vec![],
            };

            SkillScanResult {
                skill_id: s.id.clone(),
                skill_name: s.name.clone(),
                score: s.security_score.unwrap_or(0),
                level: s.security_level.clone().unwrap_or_else(|| "Unknown".to_string()),
                scanned_at: s.scanned_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                report,
            }
        })
        .collect();

    Ok(results)
}
