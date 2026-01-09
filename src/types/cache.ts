export interface CacheStats {
  totalRepositories: number;
  cachedRepositories: number;
  totalSizeBytes: number;
}

export interface ClearAllCachesResult {
  totalRepositories: number;
  clearedCount: number;
  failedCount: number;
  totalSizeFreed: number;
}
