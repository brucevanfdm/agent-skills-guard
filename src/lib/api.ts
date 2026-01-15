import { invoke } from "@tauri-apps/api/core";
import type { Repository, Skill, CacheStats, FeaturedRepositoriesConfig, ClearAllCachesResult } from "../types";
import type { SecurityReport } from "../types/security";

export const api = {
  // Repository APIs
  async addRepository(url: string, name: string): Promise<string> {
    return invoke("add_repository", { url, name });
  },

  async getRepositories(): Promise<Repository[]> {
    return invoke("get_repositories");
  },

  async deleteRepository(repoId: string): Promise<void> {
    return invoke("delete_repository", { repoId });
  },

  async scanRepository(repoId: string): Promise<Skill[]> {
    return invoke("scan_repository", { repoId });
  },

  // Skill APIs
  async getSkills(): Promise<Skill[]> {
    return invoke("get_skills");
  },

  async getInstalledSkills(): Promise<Skill[]> {
    return invoke("get_installed_skills");
  },

  async installSkill(skillId: string, installPath?: string): Promise<void> {
    return invoke("install_skill", { skillId, installPath: installPath || null });
  },

  async uninstallSkill(skillId: string): Promise<void> {
    return invoke("uninstall_skill", { skillId });
  },

  async uninstallSkillPath(skillId: string, path: string): Promise<void> {
    return invoke("uninstall_skill_path", { skillId, path });
  },

  async deleteSkill(skillId: string): Promise<void> {
    return invoke("delete_skill", { skillId });
  },

  // Scan local skills directory
  async scanLocalSkills(): Promise<Skill[]> {
    return invoke("scan_local_skills");
  },

  // 缓存管理
  async clearRepositoryCache(repoId: string): Promise<void> {
    return invoke("clear_repository_cache", { repoId });
  },

  async clearAllRepositoryCaches(): Promise<ClearAllCachesResult> {
    return invoke("clear_all_repository_caches");
  },

  async refreshRepositoryCache(repoId: string): Promise<Skill[]> {
    return invoke("refresh_repository_cache", { repoId });
  },

  async getCacheStats(): Promise<CacheStats> {
    return invoke("get_cache_stats");
  },

  // 打开技能目录
  async openSkillDirectory(localPath: string): Promise<void> {
    return invoke("open_skill_directory", { localPath });
  },

  // Featured repositories
  async getFeaturedRepositories(): Promise<FeaturedRepositoriesConfig> {
    return invoke("get_featured_repositories");
  },

  async refreshFeaturedRepositories(): Promise<FeaturedRepositoriesConfig> {
    return invoke("refresh_featured_repositories");
  },

  async isRepositoryAdded(url: string): Promise<boolean> {
    return invoke("is_repository_added", { url });
  },

  // Skill Update APIs
  async checkSkillsUpdates(): Promise<Array<[string, string]>> {
    return invoke("check_skills_updates");
  },

  async prepareSkillUpdate(skillId: string, locale: string): Promise<[SecurityReport, string[]]> {
    return invoke("prepare_skill_update", { skillId, locale });
  },

  async confirmSkillUpdate(skillId: string, forceOverwrite: boolean): Promise<void> {
    return invoke("confirm_skill_update", { skillId, forceOverwrite });
  },

  async cancelSkillUpdate(skillId: string): Promise<void> {
    return invoke("cancel_skill_update", { skillId });
  },

  // 自动扫描未扫描的仓库（首次启动）
  async autoScanUnscannedRepositories(): Promise<string[]> {
    return invoke("auto_scan_unscanned_repositories");
  },
};
