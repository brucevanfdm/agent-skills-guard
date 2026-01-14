import { useState, useMemo, useEffect } from "react";
import { useInstalledSkills, useUninstallSkill, useUninstallSkillPath } from "../hooks/useSkills";
import { Skill } from "../types";
import { SecurityReport } from "../types/security";
import { Trash2, Loader2, FolderOpen, Package, Search, RefreshCw, Download, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { appToast } from "../lib/toast";
import { countIssuesBySeverity } from "@/lib/security-utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";

const AVAILABLE_UPDATES_KEY = "available_updates";

export function InstalledSkillsPage() {
  const { t, i18n } = useTranslation();
  const { data: installedSkills, isLoading } = useInstalledSkills();
  const uninstallMutation = useUninstallSkill();
  const uninstallPathMutation = useUninstallSkillPath();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [isScanning, setIsScanning] = useState(false);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);

  // 更新相关状态 - 从 localStorage 恢复
  const [availableUpdates, setAvailableUpdates] = useState<Map<string, string>>(() => {
    try {
      const stored = localStorage.getItem(AVAILABLE_UPDATES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('[ERROR] 恢复更新状态失败:', error);
    }
    return new Map();
  });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [preparingUpdateSkillId, setPreparingUpdateSkillId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    skill: Skill;
    report: SecurityReport;
    conflicts: string[];
  } | null>(null);

  // 持久化更新状态到 localStorage
  useEffect(() => {
    try {
      if (availableUpdates.size > 0) {
        const obj = Object.fromEntries(availableUpdates);
        localStorage.setItem(AVAILABLE_UPDATES_KEY, JSON.stringify(obj));
      } else {
        localStorage.removeItem(AVAILABLE_UPDATES_KEY);
      }
    } catch (error) {
      console.error('[ERROR] 保存更新状态失败:', error);
    }
  }, [availableUpdates]);

  // 清理已卸载技能的更新标记
  useEffect(() => {
    if (!installedSkills || availableUpdates.size === 0) return;

    const installedSkillIds = new Set(installedSkills.map(skill => skill.id));
    const needsCleanup = Array.from(availableUpdates.keys()).some(
      skillId => !installedSkillIds.has(skillId)
    );

    if (needsCleanup) {
      setAvailableUpdates(prev => {
        const newMap = new Map(prev);
        for (const skillId of newMap.keys()) {
          if (!installedSkillIds.has(skillId)) {
            newMap.delete(skillId);
          }
        }
        return newMap;
      });
    }
  }, [installedSkills, availableUpdates]);

  // 添加扫描本地技能的 mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const localSkills = await api.scanLocalSkills();
      return localSkills;
    },
    onSuccess: (localSkills) => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      appToast.success(t('skills.installedPage.scanCompleted', { count: localSkills.length }));
    },
    onError: (error: any) => {
      appToast.error(t('skills.installedPage.scanFailed', { error: error.message }));
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  // 检查更新的函数
  const checkUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      const updates = await api.checkSkillsUpdates();
      const updateMap = new Map(updates.map(([skillId, latestSha]) => [skillId, latestSha]));
      setAvailableUpdates(updateMap);

      if (updates.length > 0) {
        appToast.success(t('skills.installedPage.updatesFound', { count: updates.length }));
      } else {
        appToast.success(t('skills.installedPage.noUpdates'));
      }
    } catch (error: any) {
      appToast.error(t('skills.installedPage.checkUpdatesFailed', { error: error.message }));
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  // 对技能进行去重合并，同一个技能的多个安装记录合并为一个
  const mergedSkills = useMemo(() => {
    if (!installedSkills) return [];

    const skillMap = new Map<string, Skill>();

    installedSkills.forEach((skill) => {
      // 使用技能名称作为唯一标识
      const key = skill.name;

      if (skillMap.has(key)) {
        // 如果已存在，合并 local_paths
        const existing = skillMap.get(key)!;
        const existingPaths = existing.local_paths || [];
        const newPaths = skill.local_paths || [];

        // 合并路径数组，去重
        const allPaths = Array.from(new Set([...existingPaths, ...newPaths]));

        // 更新现有技能
        skillMap.set(key, {
          ...existing,
          local_paths: allPaths,
          // 优先使用非 local 的 repository_url
          repository_url: existing.repository_url === "local" ? skill.repository_url : existing.repository_url,
          repository_owner: existing.repository_owner === "local" ? skill.repository_owner : existing.repository_owner,
        });
      } else {
        // 新技能，直接添加
        skillMap.set(key, { ...skill });
      }
    });

    return Array.from(skillMap.values());
  }, [installedSkills]);

  // 提取所有仓库及其技能数量
  const repositories = useMemo(() => {
    if (!mergedSkills) return [];
    const ownerMap = new Map<string, number>();

    mergedSkills.forEach((skill) => {
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
      { owner: "all", count: mergedSkills.length, displayName: t('skills.marketplace.allRepos') },
      ...repos
    ];
  }, [mergedSkills, i18n.language, t]);

  // 转换为 CyberSelect 选项格式
  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  // 搜索过滤和排序
  const filteredSkills = useMemo(() => {
    if (!mergedSkills) return [];

    let skills = mergedSkills;

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
              className="w-full h-10 pl-10 pr-4 py-0 bg-card border border-border rounded font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan transition-colors"
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
            className="neon-button h-10 px-4 py-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
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

          {/* Check Updates Button */}
          <button
            onClick={checkUpdates}
            disabled={isCheckingUpdates}
            className="neon-button h-10 px-4 py-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isCheckingUpdates ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.installedPage.checkingUpdates')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t('skills.installedPage.checkUpdates')}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    appToast.success(t('skills.toast.uninstalled'));
                  },
                  onError: (error: any) => {
                    setUninstallingSkillId(null);
                    appToast.error(`${t('skills.toast.uninstallFailed')}: ${error.message || error}`);
                  },
                });
              }}
              onUninstallPath={(path: string) => {
                uninstallPathMutation.mutate({ skillId: skill.id, path }, {
                  onSuccess: () => {
                    appToast.success(t('skills.toast.uninstalled'));
                  },
                  onError: (error: any) => {
                    appToast.error(`${t('skills.toast.uninstallFailed')}: ${error.message || error}`);
                  },
                });
              }}
              onUpdate={async () => {
                try {
                  console.log('[INFO] 开始准备更新技能:', skill.name);
                  setPreparingUpdateSkillId(skill.id);

                  // 调用 prepare_skill_update
                  const [report, conflicts] = await api.prepareSkillUpdate(skill.id, i18n.language);

                  console.log('[INFO] 更新准备完成，安全评分:', report.score, '冲突文件:', conflicts.length);
                  setPreparingUpdateSkillId(null);

                  // 显示更新确认弹窗
                  setPendingUpdate({ skill, report, conflicts });
                } catch (error: any) {
                  console.error('[ERROR] 更新准备失败:', error);
                  setPreparingUpdateSkillId(null);
                  appToast.error(`${t('skills.toast.updateFailed')}: ${error.message || error}`);
                }
              }}
              hasUpdate={availableUpdates.has(skill.id)}
              isUninstalling={uninstallingSkillId === skill.id}
              isPreparingUpdate={preparingUpdateSkillId === skill.id}
              isAnyOperationPending={uninstallMutation.isPending || uninstallPathMutation.isPending || preparingUpdateSkillId !== null}
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

      {/* Update Confirmation Dialog */}
      <UpdateConfirmDialog
        open={pendingUpdate !== null}
        onClose={async () => {
          // 用户取消更新，清理临时文件
          if (pendingUpdate) {
            try {
              await api.cancelSkillUpdate(pendingUpdate.skill.id);
              console.log('[INFO] 已取消更新并删除临时文件');
            } catch (error: any) {
              console.error('[ERROR] 取消更新失败:', error);
            }
          }
          setPendingUpdate(null);
        }}
        onConfirm={async (forceOverwrite: boolean) => {
          // 用户确认更新
          if (pendingUpdate) {
            try {
              await api.confirmSkillUpdate(pendingUpdate.skill.id, forceOverwrite);
              console.log('[INFO] 用户确认更新');

              // 刷新技能列表
              await queryClient.refetchQueries({ queryKey: ["skills"] });
              await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
              await queryClient.refetchQueries({ queryKey: ["scanResults"] });

              // 清除该技能的更新标记
              setAvailableUpdates(prev => {
                const newMap = new Map(prev);
                newMap.delete(pendingUpdate.skill.id);
                return newMap;
              });

              appToast.success(t('skills.toast.updateSuccess'));
            } catch (error: any) {
              console.error('[ERROR] 确认更新失败:', error);
              appToast.error(`${t('skills.toast.updateFailed')}: ${error.message || error}`);
            }
          }
          setPendingUpdate(null);
        }}
        report={pendingUpdate?.report || null}
        conflicts={pendingUpdate?.conflicts || []}
        skillName={pendingUpdate?.skill.name || ""}
      />
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  index: number;
  onUninstall: () => void;
  onUninstallPath: (path: string) => void;
  onUpdate: () => void;
  hasUpdate: boolean;
  isUninstalling: boolean;
  isPreparingUpdate: boolean;
  isAnyOperationPending: boolean;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  index,
  onUninstall,
  onUninstallPath,
  onUpdate,
  hasUpdate,
  isUninstalling,
  isPreparingUpdate,
  isAnyOperationPending,
  t
}: SkillCardProps) {
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
              repository-tag text-xs font-mono
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
          {/* Update Button - only show if update is available */}
          {hasUpdate && !skill.repository_owner?.includes("local") && (
            <button
              onClick={onUpdate}
              disabled={isAnyOperationPending}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isPreparingUpdate ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.installedPage.preparingUpdate')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('skills.update')}
                </>
              )}
            </button>
          )}

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
                {t('skills.uninstallAll')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3 font-mono">
        {skill.description || t('skills.noDescription')}
      </p>

      {/* Repository Info */}
      <div className="flex items-center gap-4 mb-3 text-xs font-mono flex-wrap">
        <span className="text-muted-foreground">
          <span className="text-terminal-green">{t('skills.repo')}</span>{" "}
          {skill.repository_url === "local" ? (
            <span className="text-muted-foreground">{skill.repository_url}</span>
          ) : (
            <a
              href={skill.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terminal-cyan hover:underline break-all"
            >
              {skill.repository_url}
            </a>
          )}
        </span>
      </div>

      {/* Installed Paths */}
      {skill.local_paths && skill.local_paths.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">
            <span className="text-terminal-green">{t('skills.installedPaths')}</span> ({skill.local_paths.length})
          </div>
          <div className="space-y-2">
            {skill.local_paths.map((path, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-card/50 rounded border border-border/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={async () => {
                      try {
                        await openPath(path);
                        appToast.success(t('skills.folder.opened'), { duration: 5000 });
                      } catch (error: any) {
                        appToast.error(
                          t('skills.folder.openFailed', { error: error?.message || String(error) }),
                          { duration: 5000 }
                        );
                      }
                    }}
                    className="text-terminal-cyan hover:text-terminal-cyan/80 transition-colors"
                    title={t('skills.openFolder')}
                  >
                    <FolderOpen className="w-3 h-3 flex-shrink-0" />
                  </button>
                  <span className="text-xs text-muted-foreground truncate" title={path}>
                    {path}
                  </span>
                </div>
                <button
                  onClick={() => onUninstallPath(path)}
                  disabled={isAnyOperationPending}
                  className="text-terminal-red hover:text-terminal-red/80 transition-colors disabled:opacity-50"
                  title={t('skills.uninstallPath')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Update Confirmation Dialog Props
interface UpdateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (forceOverwrite: boolean) => void;
  report: SecurityReport | null;
  conflicts: string[];
  skillName: string;
}

function UpdateConfirmDialog({
  open,
  onClose,
  onConfirm,
  report,
  conflicts,
  skillName
}: UpdateConfirmDialogProps) {
  const { t } = useTranslation();
  const [forceOverwrite, setForceOverwrite] = useState(false);

  const isMediumRisk = report ? report.score >= 50 && report.score < 70 : false;
  const isHighRisk = report ? report.score < 50 || report.blocked : false;
  const hasConflicts = conflicts.length > 0;

  const issueCounts = useMemo(
    () => report ? countIssuesBySeverity(report.issues) : { critical: 0, error: 0, warning: 0 },
    [report]
  );

  if (!report) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-6 h-6 text-red-500" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {t('skills.installedPage.updateScanResult')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t('skills.installedPage.preparingUpdate')}: <span className="font-mono font-bold">{skillName}</span>
              </div>

              {/* 评分 */}
              <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg">
                <span className="text-sm">{t('skills.marketplace.install.securityScore')}:</span>
                <span className={`text-3xl font-bold font-mono ${
                  report.score >= 90 ? 'text-green-500' :
                  report.score >= 70 ? 'text-green-400' :
                  report.score >= 50 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {report.score}
                </span>
              </div>

              {/* 更新前提示 */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="text-sm text-blue-400">
                  💡 {t('skills.installedPage.updateTip')}
                </div>
              </div>

              {/* 冲突文件警告 */}
              {hasConflicts && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-yellow-500 mb-1">
                        {t('skills.installedPage.conflictDetected')}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {t('skills.installedPage.conflictDescription')}
                      </div>
                      <ul className="space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
                        {conflicts.slice(0, 10).map((conflict, idx) => (
                          <li key={idx} className="text-yellow-500">• {conflict}</li>
                        ))}
                        {conflicts.length > 10 && (
                          <li className="text-muted-foreground">
                            ... {t('skills.installedPage.andMore', { count: conflicts.length - 10 })}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Force Overwrite Checkbox */}
                  <label className="flex items-center gap-2 mt-3 p-2 bg-card rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceOverwrite}
                      onChange={(e) => setForceOverwrite(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{t('skills.installedPage.forceOverwrite')}</span>
                  </label>
                </div>
              )}

              {/* 问题摘要 */}
              {report.issues.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-bold">{t('skills.marketplace.install.issuesDetected')}:</div>
                  <div className="flex gap-4 text-sm">
                    {issueCounts.critical > 0 && (
                      <span className="text-red-500">
                        {t('skills.marketplace.install.critical')}: {issueCounts.critical}
                      </span>
                    )}
                    {issueCounts.error > 0 && (
                      <span className="text-orange-500">
                        {t('skills.marketplace.install.highRisk')}: {issueCounts.error}
                      </span>
                    )}
                    {issueCounts.warning > 0 && (
                      <span className="text-yellow-500">
                        {t('skills.marketplace.install.mediumRisk')}: {issueCounts.warning}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* 具体问题列表 */}
              {report.issues.length > 0 && (
                <div className={`p-3 rounded-lg ${
                  isHighRisk ? 'bg-red-500/10 border border-red-500/50' :
                  isMediumRisk ? 'bg-yellow-500/10 border border-yellow-500/50' :
                  'bg-green-500/10 border border-green-500/50'
                }`}>
                  <ul className="space-y-1 text-sm font-mono max-h-48 overflow-y-auto">
                    {report.issues.slice(0, 5).map((issue, idx) => (
                      <li key={idx} className="text-xs">
                        {issue.file_path && (
                          <span className="text-terminal-cyan mr-1.5">[{issue.file_path}]</span>
                        )}
                        {issue.description}
                        {issue.line_number && (
                          <span className="text-muted-foreground ml-2">(行 {issue.line_number})</span>
                        )}
                      </li>
                    ))}
                    {report.issues.length > 5 && (
                      <li className="text-xs text-muted-foreground">
                        ... {t('skills.installedPage.andMore', { count: report.issues.length - 5 })}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* 高风险警告 */}
              {isHighRisk && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-500 font-bold">
                    {report.blocked
                      ? t('skills.marketplace.install.blockedWarning')
                      : t('skills.marketplace.install.highRiskWarning')}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t('skills.marketplace.install.cancel')}
          </AlertDialogCancel>

          <button
            onClick={() => onConfirm(forceOverwrite)}
            disabled={report.blocked || (hasConflicts && !forceOverwrite)}
            className="neon-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('skills.marketplace.install.continue')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
