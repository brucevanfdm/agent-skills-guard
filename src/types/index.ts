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
  repository_owner?: string;  // 仓库所有者，如 "anthropics" 或 "local"
  file_path: string;
  version?: string;
  author?: string;
  installed: boolean;
  installed_at?: string;
  local_path?: string;
  checksum?: string;
  security_score?: number;
  security_issues?: string[];
}

export enum SecurityLevel {
  Safe = "Safe",
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical",
}

export type { CacheStats, ClearAllCachesResult } from './cache';

export interface InstallPathSelection {
  type: 'user' | 'recent' | 'custom';
  path: string;
  displayName: string;
}
