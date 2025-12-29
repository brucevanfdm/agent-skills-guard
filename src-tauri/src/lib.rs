pub mod models;
pub mod security;
pub mod services;
pub mod commands;

use commands::AppState;
use services::{Database, SkillManager};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // 获取应用数据目录
            let app_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");

            let db_path = app_dir.join("agent-skills.db");

            // 初始化数据库
            let db = Database::new(db_path)
                .expect("Failed to initialize database");

            let db = Arc::new(db);

            // 初始化 SkillManager
            let skill_manager = SkillManager::new(Arc::clone(&db));
            let skill_manager = Arc::new(Mutex::new(skill_manager));

            // 初始化 GitHub 服务
            let github = Arc::new(services::GitHubService::new());

            // 设置应用状态
            app.manage(AppState {
                db,
                skill_manager,
                github,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_repository,
            commands::get_repositories,
            commands::delete_repository,
            commands::scan_repository,
            commands::get_skills,
            commands::get_installed_skills,
            commands::install_skill,
            commands::uninstall_skill,
            commands::delete_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
