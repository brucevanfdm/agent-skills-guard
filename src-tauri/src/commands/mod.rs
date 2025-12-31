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
) -> Result<String, String> {
    let repo = Repository::new(url, name);
    let repo_id = repo.id.clone();
    state.db.add_repository(&repo)
        .map_err(|e| e.to_string())?;
    Ok(repo_id)
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
    use chrono::Utc;

    // 获取仓库信息
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "仓库不存在".to_string())?;

    let (owner, repo_name) = Repository::from_github_url(&repo.url)
        .map_err(|e| e.to_string())?;

    // 确定缓存基础目录
    let cache_base_dir = dirs::cache_dir()
        .ok_or("无法获取缓存目录".to_string())?
        .join("agent-skills-guard")
        .join("repositories");

    let skills = if let Some(cache_path) = &repo.cache_path {
        // 使用缓存扫描(0次API请求)
        log::info!("使用本地缓存扫描仓库: {}", repo.name);

        let cache_path_buf = std::path::PathBuf::from(cache_path);
        if cache_path_buf.exists() && cache_path_buf.is_dir() {
            state.github.scan_cached_repository(&cache_path_buf, &repo.url, repo.scan_subdirs)
                .map_err(|e| format!("扫描缓存失败: {}", e))?
        } else {
            // 缓存路径不存在，重新下载
            log::warn!("缓存路径不存在，重新下载: {:?}", cache_path_buf);
            let extract_dir = state.github
                .download_repository_archive(&owner, &repo_name, &cache_base_dir)
                .await
                .map_err(|e| format!("下载仓库压缩包失败: {}", e))?;

            // 更新数据库缓存信息
            state.db.update_repository_cache(
                &repo_id,
                &extract_dir.to_string_lossy(),
                Utc::now(),
                None,  // cached_commit_sha - Task 4修复后需要此参数
            ).map_err(|e| e.to_string())?;

            state.github.scan_cached_repository(&extract_dir, &repo.url, repo.scan_subdirs)
                .map_err(|e| format!("扫描缓存失败: {}", e))?
        }
    } else {
        // 首次扫描: 下载压缩包并缓存(1次API请求)
        log::info!("首次扫描，下载仓库压缩包: {}", repo.name);

        let extract_dir = state.github
            .download_repository_archive(&owner, &repo_name, &cache_base_dir)
            .await
            .map_err(|e| format!("下载仓库压缩包失败: {}", e))?;

        // 更新数据库缓存信息
        state.db.update_repository_cache(
            &repo_id,
            &extract_dir.to_string_lossy(),
            Utc::now(),
            None,  // cached_commit_sha - Task 4修复后需要此参数
        ).map_err(|e| e.to_string())?;

        // 扫描本地缓存
        state.github.scan_cached_repository(&extract_dir, &repo.url, repo.scan_subdirs)
            .map_err(|e| format!("扫描缓存失败: {}", e))?
    };

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

/// 扫描本地技能目录并导入未追踪的技能
#[tauri::command]
pub async fn scan_local_skills(
    state: State<'_, AppState>,
) -> Result<Vec<Skill>, String> {
    let manager = state.skill_manager.lock().await;
    manager.scan_local_skills()
        .map_err(|e| e.to_string())
}

/// 清理指定仓库的缓存
#[tauri::command]
pub async fn clear_repository_cache(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or("仓库不存在")?;

    if let Some(cache_path) = &repo.cache_path {
        let cache_path_buf = std::path::PathBuf::from(cache_path);

        // 验证缓存路径是否在预期的缓存目录中
        let expected_cache_base = dirs::cache_dir()
            .ok_or("无法获取缓存目录".to_string())?
            .join("agent-skills-guard")
            .join("repositories");

        // 删除整个仓库缓存目录（包括archive.zip和extracted/）
        if let Some(parent) = cache_path_buf.parent() {
            // 安全检查：确保路径在预期的缓存目录中
            if !parent.starts_with(&expected_cache_base) {
                return Err("缓存路径无效".to_string());
            }

            // 先清除数据库中的缓存信息
            state.db.clear_repository_cache_metadata(&repo_id)
                .map_err(|e| e.to_string())?;

            // 然后删除文件（即使失败也不影响数据库一致性）
            if parent.exists() {
                if let Err(e) = std::fs::remove_dir_all(parent) {
                    log::warn!("删除缓存目录失败，但数据库已清理: {:?}，错误: {}", parent, e);
                    // 不返回错误，因为数据库已经一致
                } else {
                    log::info!("已删除缓存目录: {:?}", parent);
                }
            }
        }
    }

    Ok(())
}

/// 刷新仓库缓存（清理后重新扫描）
#[tauri::command]
pub async fn refresh_repository_cache(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<Skill>, String> {
    // 先清理缓存
    clear_repository_cache(state.clone(), repo_id.clone()).await?;

    // 重新扫描（会自动下载新版本）
    scan_repository(state, repo_id).await
}

/// 获取缓存统计信息
#[tauri::command]
pub async fn get_cache_stats(
    state: State<'_, AppState>,
) -> Result<CacheStats, String> {
    let repos = state.db.get_repositories()
        .map_err(|e| e.to_string())?;

    let mut total_cached = 0;
    let mut total_size: u64 = 0;

    for repo in &repos {
        if let Some(cache_path) = &repo.cache_path {
            if let Some(parent) = std::path::PathBuf::from(cache_path).parent() {
                if parent.exists() {
                    total_cached += 1;

                    // 计算目录大小
                    if let Ok(size) = dir_size(parent) {
                        total_size += size;
                    }
                }
            }
        }
    }

    Ok(CacheStats {
        total_repositories: repos.len(),
        cached_repositories: total_cached,
        total_size_bytes: total_size,
    })
}

/// 计算目录大小
fn dir_size(path: &std::path::Path) -> Result<u64, std::io::Error> {
    use walkdir::WalkDir;

    let mut size = 0;

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            size += entry.metadata()?.len();
        }
    }

    Ok(size)
}

/// 缓存统计信息
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub total_repositories: usize,
    pub cached_repositories: usize,
    pub total_size_bytes: u64,
}
