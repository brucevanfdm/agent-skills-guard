use crate::commands::AppState;
use crate::models::{Plugin, SecurityReport};
use crate::services::plugin_manager::PluginInstallResult;
use tauri::State;

/// 获取所有 plugins
#[tauri::command]
pub async fn get_plugins(
    state: State<'_, AppState>,
) -> Result<Vec<Plugin>, String> {
    state.db.get_plugins()
        .map_err(|e| e.to_string())
}

/// 准备安装 plugin：下载并扫描 marketplace repo
#[tauri::command]
pub async fn prepare_plugin_installation(
    state: State<'_, AppState>,
    plugin_id: String,
    locale: String,
) -> Result<SecurityReport, String> {
    let manager = state.plugin_manager.lock().await;
    manager.prepare_plugin_installation(&plugin_id, &locale).await
        .map_err(|e| e.to_string())
}

/// 确认安装 plugin：驱动 Claude Code CLI 执行安装
#[tauri::command]
pub async fn confirm_plugin_installation(
    state: State<'_, AppState>,
    plugin_id: String,
    claude_command: Option<String>,
) -> Result<PluginInstallResult, String> {
    let manager = state.plugin_manager.lock().await;
    manager.confirm_plugin_installation(&plugin_id, claude_command).await
        .map_err(|e| e.to_string())
}

/// 取消 plugin 安装准备状态
#[tauri::command]
pub async fn cancel_plugin_installation(
    state: State<'_, AppState>,
    plugin_id: String,
) -> Result<(), String> {
    let manager = state.plugin_manager.lock().await;
    manager.cancel_plugin_installation(&plugin_id)
        .map_err(|e| e.to_string())
}
