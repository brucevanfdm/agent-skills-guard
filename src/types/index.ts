export interface Repository {
  id: string;
  url: string;
  name: string;
  description?: string;
  enabled: boolean;
  scan_subdirs: boolean;
  added_at: string;
  last_scanned?: string;
  // 新增:缓存字段
  cache_path?: string;
  cached_at?: string;
  cached_commit_sha?: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  repository_url: string;
  repository_owner?: string;  // 仓库所有者,如 "anthropics" 或 "local"
  file_path: string;
  version?: string;
  author?: string;
  installed: boolean;
  installed_at?: string;
  local_path?: string;  // 向后兼容,保留单个路径字段
  local_paths?: string[];  // 新增:支持多个安装路径
  checksum?: string;
  security_score?: number;
  security_issues?: string[];
  installed_commit_sha?: string;  // 安装时的 commit SHA，用于版本追踪
}

export interface Plugin {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  repository_url: string;
  repository_owner?: string;
  marketplace_name: string;
  source: string;
  installed: boolean;
  installed_at?: string;
  security_score?: number;
  security_issues?: string[];
  security_level?: string;
  scanned_at?: string;
  staging_path?: string;
  install_log?: string;
  install_status?: string;
}

export interface PluginInstallStatus {
  plugin_id: string;
  plugin_name: string;
  status: string;
  output: string;
}

export interface PluginInstallResult {
  marketplace_name: string;
  marketplace_repo: string;
  marketplace_status: string;
  raw_log: string;
  plugin_statuses: PluginInstallStatus[];
}

export enum SecurityLevel {
  Safe = "Safe",
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical",
}

export type { CacheStats, ClearAllCachesResult } from './cache';
export type {
  FeaturedRepositoriesConfig,
  FeaturedRepository,
  FeaturedRepositoryCategory
} from './featured';

export interface InstallPathSelection {
  type: 'user' | 'recent' | 'custom';
  path: string;
  displayName: string;
}
