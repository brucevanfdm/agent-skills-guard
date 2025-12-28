import { invoke } from "@tauri-apps/api/core";
import { Repository, Skill } from "../types";

export const api = {
  // Repository APIs
  async addRepository(url: string, name: string): Promise<void> {
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
};
