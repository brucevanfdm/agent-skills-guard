type RepositoryTagged = {
  repository_owner?: string;
  repository_url: string;
};

/**
 * 从 repository_url 解析仓库所有者
 */
export function parseRepositoryOwner(repositoryUrl: string): string {
  if (repositoryUrl === "local") return "本地";

  // 解析 GitHub URL: https://github.com/anthropics/skills
  const match = repositoryUrl.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : "未知";
}

/**
 * 格式化显示仓库标识
 */
export function formatRepositoryTag(entry: RepositoryTagged): string {
  const owner = entry.repository_owner || parseRepositoryOwner(entry.repository_url);
  return owner === "local" ? "本地" : `@${owner}`;
}

/**
 * 获取仓库所有者的显示名称（用于筛选器）
 */
export function getRepositoryDisplayName(owner: string): string {
  if (owner === "local") return "本地";
  return `@${owner}`;
}
