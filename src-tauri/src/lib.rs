pub mod models;
pub mod security;
pub mod services;
pub mod commands;

use commands::AppState;
use commands::security::{scan_all_installed_skills, get_scan_results, scan_skill_archive};
use services::{Database, SkillManager};
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tokio::sync::Mutex;

const MAIN_WINDOW_LABEL: &str = "main";
const MENU_SHOW: &str = "show";
const MENU_HIDE: &str = "hide";
const MENU_QUIT: &str = "quit";

fn create_tray_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let show_item = MenuItemBuilder::with_id(MENU_SHOW, "显示窗口").build(app)?;
    let hide_item = MenuItemBuilder::with_id(MENU_HIDE, "隐藏窗口").build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT, "退出").build(app)?;

    MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .separator()
        .item(&quit_item)
        .build()
}

fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    log::debug!("菜单事件: {}", event.id().as_ref());

    match event.id().as_ref() {
        MENU_SHOW => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(e) = window.show() {
                    log::warn!("显示窗口失败: {}", e);
                }
                if let Err(e) = window.set_focus() {
                    log::warn!("设置窗口焦点失败: {}", e);
                }
            } else {
                log::error!("无法获取主窗口");
            }
        }
        MENU_HIDE => {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(e) = window.hide() {
                    log::warn!("隐藏窗口失败: {}", e);
                }
            } else {
                log::error!("无法获取主窗口");
            }
        }
        MENU_QUIT => {
            log::info!("用户通过托盘菜单退出应用");
            app.exit(0);
        }
        _ => {
            log::warn!("未知的菜单事件: {}", event.id().as_ref());
        }
    }
}

fn handle_tray_event(tray: &tauri::tray::TrayIcon<tauri::Wry>, event: tauri::tray::TrayIconEvent) {
    if let tauri::tray::TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        log::debug!("托盘图标被点击");
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            match window.is_visible() {
                Ok(true) => {
                    if let Err(e) = window.hide() {
                        log::warn!("隐藏窗口失败: {}", e);
                    }
                }
                Ok(false) => {
                    if let Err(e) = window.show() {
                        log::warn!("显示窗口失败: {}", e);
                    }
                    if let Err(e) = window.set_focus() {
                        log::warn!("设置窗口焦点失败: {}", e);
                    }
                }
                Err(e) => {
                    log::error!("检查窗口可见性失败: {}", e);
                }
            }
        } else {
            log::error!("无法获取主窗口");
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
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

            // 初始化系统托盘
            let icon = app.default_window_icon()
                .ok_or("无法获取默认窗口图标")?
                .clone();

            let app_handle = app.handle();
            let menu = create_tray_menu(&app_handle)?;

            let tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("Agent Skills Guard")
                .menu(&menu)
                .on_tray_icon_event(handle_tray_event)
                .on_menu_event(handle_menu_event)
                .build(app)?;

            // 存储托盘实例到 app state
            app.manage(tray);

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
            commands::scan_local_skills,
            commands::clear_repository_cache,
            commands::refresh_repository_cache,
            commands::get_cache_stats,
            scan_all_installed_skills,
            get_scan_results,
            scan_skill_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
