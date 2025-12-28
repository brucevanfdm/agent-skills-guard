use crate::models::{Repository, Skill};
use crate::services::{Database, GitHubService, SkillManager};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub struct AppState {
    pub db: Arc<Database>,
    pub skill_manager: Arc<Mutex<SkillManager>>,
    pub github: Arc<GitHubService>,
}

/// 添加仓库
#[tauri::command]
pub async fn add_repository(
    state: State<'_, AppState>,
    url: String,
    name: String,
) -> Result<(), String> {
    let repo = Repository::new(url, name);
    state.db.add_repository(&repo)
        .map_err(|e| e.to_string())
}

/// 获取所有仓库
#[tauri::command]
pub async fn get_repositories(
    state: State<'_, AppState>,
) -> Result<Vec<Repository>, String> {
    state.db.get_repositories()
        .map_err(|e| e.to_string())
}

/// 删除仓库
#[tauri::command]
pub async fn delete_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    state.db.delete_repository(&repo_id)
        .map_err(|e| e.to_string())
}

/// 扫描仓库中的 skills
#[tauri::command]
pub async fn scan_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<Skill>, String> {
    // 获取仓库信息
    let repos = state.db.get_repositories()
        .map_err(|e| e.to_string())?;

    let repo = repos.into_iter()
        .find(|r| r.id == repo_id)
        .ok_or_else(|| "Repository not found".to_string())?;

    // 扫描仓库
    let skills = state.github.scan_repository(&repo).await
        .map_err(|e| e.to_string())?;

    // 保存到数据库
    for skill in &skills {
        state.db.save_skill(skill)
            .map_err(|e| e.to_string())?;
    }

    Ok(skills)
}

/// 获取所有 skills
#[tauri::command]
pub async fn get_skills(
    state: State<'_, AppState>,
) -> Result<Vec<Skill>, String> {
    let manager = state.skill_manager.lock().await;
    manager.get_all_skills()
        .map_err(|e| e.to_string())
}

/// 获取已安装的 skills
#[tauri::command]
pub async fn get_installed_skills(
    state: State<'_, AppState>,
) -> Result<Vec<Skill>, String> {
    let manager = state.skill_manager.lock().await;
    manager.get_installed_skills()
        .map_err(|e| e.to_string())
}

/// 安装 skill
#[tauri::command]
pub async fn install_skill(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<(), String> {
    let manager = state.skill_manager.lock().await;
    manager.install_skill(&skill_id).await
        .map_err(|e| e.to_string())
}

/// 卸载 skill
#[tauri::command]
pub async fn uninstall_skill(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<(), String> {
    let manager = state.skill_manager.lock().await;
    manager.uninstall_skill(&skill_id)
        .map_err(|e| e.to_string())
}

/// 删除 skill 记录
#[tauri::command]
pub async fn delete_skill(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<(), String> {
    state.db.delete_skill(&skill_id)
        .map_err(|e| e.to_string())
}
