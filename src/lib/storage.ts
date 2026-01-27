const RECENT_PATHS_KEY = "recentInstallPaths";
const MAX_RECENT_PATHS = 3;
const PLUGIN_SCAN_PROMPT_KEY = "asguard.preferences.pluginScanPrompt.v1";

/**
 * 获取最近使用的安装路径列表
 */
export function getRecentInstallPaths(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PATHS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn("Failed to get recent install paths:", error);
    return [];
  }
}

/**
 * 添加安装路径到最近使用列表
 * @param path 安装路径
 */
export function addRecentInstallPath(path: string): void {
  try {
    let paths = getRecentInstallPaths();

    // 移除重复项（不区分大小写比较）
    paths = paths.filter((p) => p.toLowerCase() !== path.toLowerCase());

    // 添加到开头
    paths.unshift(path);

    // 限制数量为 3
    if (paths.length > MAX_RECENT_PATHS) {
      paths = paths.slice(0, MAX_RECENT_PATHS);
    }

    localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(paths));
  } catch (error) {
    console.warn("Failed to save recent install path:", error);
  }
}

export function getPluginScanPromptEnabled(): boolean {
  try {
    const stored = localStorage.getItem(PLUGIN_SCAN_PROMPT_KEY);
    if (stored === null) return true;
    return stored === "true";
  } catch (error) {
    console.warn("Failed to read scan prompt preference:", error);
    return true;
  }
}

export function setPluginScanPromptEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PLUGIN_SCAN_PROMPT_KEY, String(enabled));
  } catch (error) {
    console.warn("Failed to save scan prompt preference:", error);
  }
}
