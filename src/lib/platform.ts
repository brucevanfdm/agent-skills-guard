import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'macos' | 'windows' | 'linux' | 'unknown';

let cachedPlatform: Platform | null = null;

/**
 * 获取当前操作系统平台
 * @returns 平台类型
 */
export async function getPlatform(): Promise<Platform> {
  if (cachedPlatform) {
    return cachedPlatform;
  }

  try {
    const platformName = await platform();

    switch (platformName) {
      case 'macos':
        cachedPlatform = 'macos';
        break;
      case 'windows':
        cachedPlatform = 'windows';
        break;
      case 'linux':
        cachedPlatform = 'linux';
        break;
      default:
        cachedPlatform = 'unknown';
    }

    return cachedPlatform;
  } catch (error) {
    console.error('Failed to detect platform:', error);
    cachedPlatform = 'unknown';
    return cachedPlatform;
  }
}

/**
 * 检查是否为 macOS
 */
export async function isMacOS(): Promise<boolean> {
  return (await getPlatform()) === 'macos';
}

/**
 * 检查是否为 Windows
 */
export async function isWindows(): Promise<boolean> {
  return (await getPlatform()) === 'windows';
}
