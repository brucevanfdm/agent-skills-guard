import { invoke } from "@tauri-apps/api/core";
import type { Repository, Skill, CacheStats } from "../types";

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

  async installSkill(skillId: string): Promise<void> {
    return invoke("install_skill", { skillId });
  },

  async uninstallSkill(skillId: string): Promise<void> {
    return invoke("uninstall_skill", { skillId });
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
};
