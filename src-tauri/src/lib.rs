// 初始化 i18n，设置 fallback 语言为中文
rust_i18n::i18n!("locales", fallback = "zh");

pub mod commands;
mod i18n;
pub mod models;
pub mod security;
pub mod services;

use commands::security::{get_scan_results, scan_all_installed_skills, scan_skill_archive};
use commands::AppState;
use services::{Database, PluginManager, SkillManager};
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};
use tauri::Manager;
use tokio::sync::Mutex;

const MAIN_WINDOW_LABEL: &str = "main";
const MENU_SHOW: &str = "show";
const MENU_HIDE: &str = "hide";
const MENU_QUIT: &str = "quit";

#[cfg(target_os = "macos")]
const MACOS_TRAY_TEMPLATE_ICON: tauri::image::Image<'static> =
    tauri::include_image!("icons/tray-icon-template.png");

#[cfg(target_os = "macos")]
fn maybe_suppress_macos_os_activity_logs() {
    // macOS 在某些场景会输出类似：
    // CoreText note: Client requested name ".SFNS-..."
    // 这类日志通常来自系统/依赖层（如 WebKit），对应用功能无影响，但会污染开发期控制台输出。
    //
    // 默认：在 macOS 下抑制（避免影响用户/开发者体验）。
    // 如需强制开启（不抑制），可显式设置 OS_ACTIVITY_MODE（例如：`OS_ACTIVITY_MODE=default`）。
    if std::env::var_os("OS_ACTIVITY_MODE").is_some() {
        return;
    }

    std::env::set_var("OS_ACTIVITY_MODE", "disable");
}

/// 获取托盘菜单文本（中英文双语）
///
/// 返回值：(显示窗口文本, 隐藏窗口文本, 退出文本)
fn get_menu_texts() -> (&'static str, &'static str, &'static str) {
    // 简化版：使用中英文双语显示
    ("显示 / Show", "隐藏 / Hide", "退出 / Quit")
}

fn create_tray_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let (show_text, hide_text, quit_text) = get_menu_texts();

    let show_item = MenuItemBuilder::with_id(MENU_SHOW, show_text).build(app)?;
    let hide_item = MenuItemBuilder::with_id(MENU_HIDE, hide_text).build(app)?;
    let quit_item = MenuItemBuilder::with_id(MENU_QUIT, quit_text).build(app)?;

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
    #[cfg(target_os = "macos")]
    maybe_suppress_macos_os_activity_logs();

    // 初始化日志
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 获取应用数据目录
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

            let db_path = app_dir.join("agent-skills.db");

            // 初始化数据库
            let db = Database::new(db_path).expect("Failed to initialize database");

            let db = Arc::new(db);

            // 初始化 SkillManager
            let skill_manager = SkillManager::new(Arc::clone(&db));
            let skill_manager = Arc::new(Mutex::new(skill_manager));

            // 初始化 PluginManager
            let plugin_manager = PluginManager::new(Arc::clone(&db));
            let plugin_manager = Arc::new(Mutex::new(plugin_manager));

            // 初始化 GitHub 服务
            let github = Arc::new(services::GitHubService::new());

            // 设置应用状态
            app.manage(AppState {
                db,
                skill_manager,
                plugin_manager,
                github,
            });

            // 初始化系统托盘
            let icon = {
                #[cfg(target_os = "macos")]
                {
                    MACOS_TRAY_TEMPLATE_ICON.clone()
                }

                #[cfg(not(target_os = "macos"))]
                {
                    app.default_window_icon()
                        .ok_or("无法获取默认窗口图标")?
                        .clone()
                }
            };

            let app_handle = app.handle();
            let menu = create_tray_menu(&app_handle)?;

            let tray = TrayIconBuilder::new()
                .icon(icon)
                .icon_as_template(cfg!(target_os = "macos"))
                .tooltip("Agent Skills Guard")
                .menu(&menu)
                .on_tray_icon_event(handle_tray_event)
                .on_menu_event(handle_menu_event)
                .build(app)?;

            // 存储托盘实例到 app state
            app.manage(tray);

            // 监听窗口关闭请求，改为隐藏到托盘
            if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let app_handle = app.handle().clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        log::info!("窗口关闭请求，隐藏到托盘而不是退出");
                        // 阻止默认关闭行为
                        api.prevent_close();
                        // 隐藏窗口而不是关闭
                        if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                            if let Err(e) = window.hide() {
                                log::error!("隐藏窗口失败: {}", e);
                            }
                        } else {
                            log::error!("无法获取主窗口");
                        }
                    }
                });
            } else {
                log::warn!("无法获取主窗口，窗口关闭监听器未设置");
            }

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
            commands::prepare_skill_installation,
            commands::confirm_skill_installation,
            commands::cancel_skill_installation,
            commands::uninstall_skill,
            commands::uninstall_skill_path,
            commands::delete_skill,
            commands::scan_local_skills,
            commands::clear_repository_cache,
            commands::clear_all_repository_caches,
            commands::refresh_repository_cache,
            commands::get_cache_stats,
            commands::open_skill_directory,
            commands::get_default_install_path,
            commands::select_custom_install_path,
            commands::get_featured_repositories,
            commands::refresh_featured_repositories,
            commands::reset_app_data,
            commands::is_repository_added,
            commands::check_skills_updates,
            commands::prepare_skill_update,
            commands::confirm_skill_update,
            commands::cancel_skill_update,
            commands::auto_scan_unscanned_repositories,
            commands::plugins::get_plugins,
            commands::plugins::prepare_plugin_installation,
            commands::plugins::confirm_plugin_installation,
            commands::plugins::cancel_plugin_installation,
            commands::plugins::uninstall_plugin,
            commands::plugins::remove_marketplace,
            scan_all_installed_skills,
            get_scan_results,
            scan_skill_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
