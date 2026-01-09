import { useState, useMemo } from "react";
import { useInstalledSkills, useUninstallSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { Trash2, Loader2, FolderOpen, Package, Search, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { formatRepositoryTag } from "../lib/utils";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export function InstalledSkillsPage() {
  const { t, i18n } = useTranslation();
  const { data: installedSkills, isLoading } = useInstalledSkills();
  const uninstallMutation = useUninstallSkill();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 添加扫描本地技能的 mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const localSkills = await api.scanLocalSkills();
      return localSkills;
    },
    onSuccess: (localSkills) => {
      queryClient.invalidateQueries({ queryKey: ["installedSkills"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      showToast(t('skills.installedPage.scanCompleted', { count: localSkills.length }));
    },
    onError: (error: any) => {
      showToast(t('skills.installedPage.scanFailed', { error: error.message }));
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  // 提取所有仓库及其技能数量
  const repositories = useMemo(() => {
    if (!installedSkills) return [];
    const ownerMap = new Map<string, number>();

    installedSkills.forEach((skill) => {
      const owner = skill.repository_owner || "unknown";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    });

    const repos = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({
        owner,
        count,
        displayName: owner === "local" ? t('skills.marketplace.localRepo') : `@${owner}`
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return [
      { owner: "all", count: installedSkills.length, displayName: t('skills.marketplace.allRepos') },
      ...repos
    ];
  }, [installedSkills, i18n.language, t]);

  // 转换为 CyberSelect 选项格式
  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  // 搜索过滤和排序
  const filteredSkills = useMemo(() => {
    if (!installedSkills) return [];

    let skills = installedSkills;

    // 仓库过滤
    if (selectedRepository !== "all") {
      skills = skills.filter(
        (skill) => skill.repository_owner === selectedRepository
      );
    }

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatches: Skill[] = [];
      const descriptionMatches: Skill[] = [];

      skills.forEach((skill) => {
        const nameMatch = skill.name.toLowerCase().includes(query);
        const descriptionMatch = skill.description?.toLowerCase().includes(query);

        if (nameMatch) {
          nameMatches.push(skill);
        } else if (descriptionMatch) {
          descriptionMatches.push(skill);
        }
      });

      // 名称匹配的在前，描述匹配的在后
      skills = [...nameMatches, ...descriptionMatches];
    }

    // 如果没有搜索关键词，按安装时间排序，最近安装的在前
    if (!searchQuery) {
      skills = [...skills].sort((a, b) => {
        const timeA = a.installed_at ? new Date(a.installed_at).getTime() : 0;
        const timeB = b.installed_at ? new Date(b.installed_at).getTime() : 0;
        return timeB - timeA; // 降序排列
      });
    }

    return skills;
  }, [installedSkills, searchQuery, selectedRepository]);

  return (
    <div className="space-y-6" style={{ animation: 'slideInLeft 0.5s ease-out' }}>
      {/* Header Section */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg text-terminal-cyan tracking-wider flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span>{t('nav.installed')}</span>
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              <span className="text-terminal-green">&gt;</span> {t('skills.installedPage.count', { count: filteredSkills.length })}
            </p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('skills.installedPage.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan transition-colors"
            />
          </div>

          {/* Repository Filter */}
          <CyberSelect
            value={selectedRepository}
            onChange={setSelectedRepository}
            options={repositoryOptions}
            className="min-w-[200px]"
          />

          {/* Scan Local Skills Button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
            className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.installedPage.scanning')}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {t('skills.installedPage.scanLocal')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-terminal-cyan animate-spin mb-4" />
          <p className="text-sm font-mono text-terminal-cyan terminal-cursor">{t('skills.loading')}</p>
        </div>
      ) : filteredSkills && filteredSkills.length > 0 ? (
        <div className="grid gap-4">
          {filteredSkills.map((skill, index) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              index={index}
              onUninstall={() => {
                setUninstallingSkillId(skill.id);
                uninstallMutation.mutate(skill.id, {
                  onSuccess: () => {
                    setUninstallingSkillId(null);
                    showToast(t('skills.toast.uninstalled'));
                  },
                  onError: (error: any) => {
                    setUninstallingSkillId(null);
                    showToast(`${t('skills.toast.uninstallFailed')}: ${error.message || error}`);
                  },
                });
              }}
              isUninstalling={uninstallingSkillId === skill.id}
              isAnyOperationPending={uninstallMutation.isPending}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg">
          <div className="text-terminal-cyan font-mono text-2xl mb-4">
            {searchQuery ? "🔍" : "📦"}
          </div>
          <p className="text-sm text-muted-foreground font-mono">
            {searchQuery ? t('skills.installedPage.noResults', { query: searchQuery }) : t('skills.installedPage.empty')}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 px-4 py-2 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors font-mono text-sm"
            >
              {t('skills.installedPage.clearSearch')}
            </button>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-6 py-4 rounded border border-terminal-cyan bg-card/95 backdrop-blur-sm shadow-2xl z-50"
          style={{
            animation: 'slideInLeft 0.3s ease-out',
            boxShadow: '0 0 20px rgba(94, 234, 212, 0.3), 0 0 40px rgba(94, 234, 212, 0.1)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-terminal-cyan animate-pulse"></div>
            <span className="font-mono text-sm text-terminal-cyan">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  index: number;
  onUninstall: () => void;
  isUninstalling: boolean;
  isAnyOperationPending: boolean;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  index,
  onUninstall,
  isUninstalling,
  isAnyOperationPending,
  t
}: SkillCardProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showLocalToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const handleOpenFolder = async () => {
    if (!skill.local_path) return;

    try {
      await invoke('open_skill_directory', { localPath: skill.local_path });
      showLocalToast(t('skills.folder.opened'));
    } catch (error: any) {
      console.error('[ERROR] Failed to open folder:', error);
      showLocalToast(t('skills.folder.openFailed', { error: error?.message || String(error) }));
    }
  };

  return (
    <div
      className="cyber-card p-6 group"
      style={{
        animation: 'fadeIn 0.4s ease-out',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards'
      }}
    >
      {/* Top Bar */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Skill Name with Repository Tag */}
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-lg font-bold text-foreground tracking-wide">
              {skill.name}
            </h3>

            {/* Repository Tag */}
            <span className={`
              status-indicator text-xs font-mono
              ${skill.repository_owner === "local"
                ? "text-muted-foreground border-muted-foreground/30 bg-muted/10"
                : "text-terminal-cyan border-terminal-cyan/30 bg-terminal-cyan/10"
              }
            `}>
              {formatRepositoryTag(skill)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={onUninstall}
            disabled={isAnyOperationPending}
            className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.uninstalling')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {t('skills.uninstall')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3 font-mono">
        {skill.description || t('skills.noDescription')}
      </p>

      {/* Skill Info */}
      <div className="space-y-2">
        {/* Security Score */}
        {skill.security_score != null && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-terminal-cyan">{t('skills.marketplace.install.securityScore')}:</span>
            <span className={`font-bold ${
              skill.security_score >= 90 ? 'text-terminal-green' :
              skill.security_score >= 70 ? 'text-terminal-yellow' :
              skill.security_score >= 50 ? 'text-terminal-orange' : 'text-terminal-red'
            }`}>
              {skill.security_score}/100
            </span>
          </div>
        )}

        {/* Installed Time */}
        {skill.installed_at && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-terminal-cyan">{t('skills.installedAt')}:</span>
            <span className="text-muted-foreground">
              {new Date(skill.installed_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        )}

        {/* Local Path - Clickable to open folder */}
        {skill.local_path && (
          <div className="flex items-start gap-2 text-xs font-mono">
            <span className="text-terminal-cyan whitespace-nowrap">{t('skills.localPath')}:</span>
            <button
              onClick={handleOpenFolder}
              className="text-muted-foreground break-all hover:text-terminal-cyan transition-colors flex items-center gap-2 group flex-1 text-left"
            >
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 group-hover:text-terminal-cyan" />
              <span>{skill.local_path}</span>
            </button>
          </div>
        )}
      </div>

      {/* Local Toast for Folder Open Feedback */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-6 py-4 rounded border border-terminal-cyan bg-card/95 backdrop-blur-sm shadow-2xl z-50"
          style={{
            animation: 'slideInLeft 0.3s ease-out',
            boxShadow: '0 0 20px rgba(94, 234, 212, 0.3), 0 0 40px rgba(94, 234, 212, 0.1)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-terminal-cyan animate-pulse"></div>
            <span className="font-mono text-sm text-terminal-cyan">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
