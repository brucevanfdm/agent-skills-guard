import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSkills, useInstallSkill, useUninstallSkill, useUninstallSkillPath, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { SecurityReport } from "../types/security";
import { Download, Trash2, AlertTriangle, Loader2, Package, Search, FolderOpen, XCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { countIssuesBySeverity } from "@/lib/security-utils";
import { addRecentInstallPath } from "@/lib/storage";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import { InstallPathSelector } from "./InstallPathSelector";
import { appToast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";

interface MarketplacePageProps {
  onNavigateToRepositories?: () => void;
}

export function MarketplacePage({ onNavigateToRepositories }: MarketplacePageProps = {}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: allSkills, isLoading } = useSkills();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();
  const uninstallPathMutation = useUninstallSkillPath();
  const deleteMutation = useDeleteSkill();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [hideInstalled, setHideInstalled] = useState(false);
  const [pendingInstall, setPendingInstall] = useState<{
    skill: Skill;
    report: SecurityReport;
  } | null>(null);
  const [preparingSkillId, setPreparingSkillId] = useState<string | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);

  // 只显示从仓库扫描的技能，排除本地技能
  const repositorySkills = useMemo(() => {
    if (!allSkills) return [];
    return allSkills.filter(skill => skill.repository_owner !== "local");
  }, [allSkills]);

  // 提取所有仓库及其技能数量
  const repositories = useMemo(() => {
    if (!repositorySkills) return [];
    const ownerMap = new Map<string, number>();

    repositorySkills.forEach((skill) => {
      const owner = skill.repository_owner || "unknown";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    });

    const repos = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({
        owner,
        count,
        displayName: `@${owner}`
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return [
      { owner: "all", count: repositorySkills.length, displayName: t('skills.marketplace.allRepos') },
      ...repos
    ];
  }, [repositorySkills, i18n.language, t]);

  // 转换为 CyberSelect 选项格式
  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  // 筛选逻辑
  const filteredSkills = useMemo(() => {
    if (!repositorySkills) return [];

    const query = searchQuery.toLowerCase();

    // 先过滤出所有符合条件的技能
    let filtered = repositorySkills.filter((skill) => {
      // 仓库过滤
      const matchesRepo = selectedRepository === "all" ||
        skill.repository_owner === selectedRepository;

      // 安装状态过滤
      const matchesInstalled = !hideInstalled || !skill.installed;

      // 搜索过滤
      const matchesSearch = !searchQuery ||
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query);

      return matchesSearch && matchesRepo && matchesInstalled;
    });

    // 如果有搜索关键词，按匹配优先级排序
    if (searchQuery) {
      const nameMatches: Skill[] = [];
      const descriptionMatches: Skill[] = [];

      filtered.forEach((skill) => {
        const nameMatch = skill.name.toLowerCase().includes(query);
        if (nameMatch) {
          nameMatches.push(skill);
        } else {
          descriptionMatches.push(skill);
        }
      });

      // 名称匹配的在前，描述匹配的在后
      filtered = [...nameMatches, ...descriptionMatches];
    }

    return filtered;
  }, [repositorySkills, searchQuery, selectedRepository, hideInstalled]);

  return (
    <div className="space-y-6" style={{ animation: 'slideInLeft 0.5s ease-out' }}>
      {/* Header Section */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-lg text-terminal-cyan tracking-wider flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span>{t('nav.marketplace')}</span>
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            <span className="text-terminal-green">&gt;</span> {t('skills.marketplace.found', { count: filteredSkills.length })}
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('skills.marketplace.search')}
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

          {/* Hide Installed Checkbox */}
          <label className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded font-mono text-sm text-foreground cursor-pointer hover:border-terminal-cyan transition-colors">
            <input
              type="checkbox"
              checked={hideInstalled}
              onChange={(e) => setHideInstalled(e.target.checked)}
            />
            <span>{t('skills.marketplace.hideInstalled')}</span>
          </label>
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
              onInstall={async () => {
                try {
                  console.log('[INFO] 开始安装技能:', skill.name);
                  setPreparingSkillId(skill.id);

                  // 第一阶段：下载并扫描技能
                  const report = await invoke<SecurityReport>("prepare_skill_installation", {
                    skillId: skill.id,
                    locale: i18n.language,
                  });

                  console.log('[INFO] 扫描完成，评分:', report.score);
                  setPreparingSkillId(null);

                  // 统一显示安全扫描结果弹窗
                  console.log('[INFO] 显示安全扫描结果弹窗');
                  setPendingInstall({ skill, report });
                } catch (error: any) {
                  console.error('[ERROR] 安装失败:', error);
                  setPreparingSkillId(null);
                  appToast.error(`${t('skills.toast.installFailed')}: ${error.message || error}`);
                }
              }}
              onUninstall={() => {
                uninstallMutation.mutate(skill.id, {
                  onSuccess: () => {
                    appToast.success(t('skills.toast.uninstalled'));
                  },
                  onError: (error: any) => {
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
              onDelete={() => {
                setDeletingSkillId(skill.id);
                deleteMutation.mutate(skill.id, {
                  onSuccess: () => {
                    setDeletingSkillId(null);
                    appToast.success(t('skills.toast.deleted'));
                  },
                  onError: (error: any) => {
                    setDeletingSkillId(null);
                    appToast.error(`${t('skills.toast.deleteFailed')}: ${error.message || error}`);
                  },
                });
              }}
              isInstalling={installMutation.isPending && installMutation.variables?.skillId === skill.id}
              isUninstalling={uninstallMutation.isPending && uninstallMutation.variables === skill.id}
              isDeleting={deletingSkillId === skill.id}
              isPreparing={preparingSkillId === skill.id}
              isAnyOperationPending={installMutation.isPending || uninstallMutation.isPending || preparingSkillId !== null || deletingSkillId !== null}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg">
          <div className="text-terminal-cyan font-mono text-2xl mb-4">🔍</div>
          {searchQuery ? (
            <>
              <p className="text-sm text-muted-foreground font-mono mb-2">
                {t('skills.marketplace.noResults', { query: searchQuery })}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRepository("all");
                  setHideInstalled(false);
                }}
                className="mt-4 px-4 py-2 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors font-mono text-sm"
              >
                {t('skills.marketplace.clearFilters')}
              </button>
            </>
          ) : repositorySkills.length === 0 ? (
            // 完全没有技能数据，引导用户去仓库页面
            <div className="text-center max-w-md">
              <p className="text-sm text-muted-foreground font-mono mb-4">
                {t('skills.marketplace.noSkillsYet')}
              </p>
              <p className="text-xs text-muted-foreground font-mono mb-6">
                {t('skills.marketplace.scanningRepositories')}
              </p>
              <button
                onClick={() => {
                  if (onNavigateToRepositories) {
                    onNavigateToRepositories();
                  }
                }}
                disabled={!onNavigateToRepositories}
                className="px-6 py-3 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('skills.marketplace.goToRepositories')}
              </button>
            </div>
          ) : (
            // 有技能数据但被过滤掉了
            <>
              <p className="text-sm text-muted-foreground font-mono mb-2">
                {t('skills.marketplace.noSkillsInFilter')}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRepository("all");
                  setHideInstalled(false);
                }}
                className="mt-4 px-4 py-2 rounded bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/20 transition-colors font-mono text-sm"
              >
                {t('skills.marketplace.clearFilters')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Install Confirmation Dialog */}
      <InstallConfirmDialog
        open={pendingInstall !== null}
        onClose={async () => {
          // 用户点击"取消"，删除已下载的文件
          if (pendingInstall) {
            try {
              await invoke("cancel_skill_installation", {
                skillId: pendingInstall.skill.id,
              });
              console.log('[INFO] 已取消安装并删除文件');
            } catch (error: any) {
              console.error('[ERROR] 取消安装失败:', error);
            }
          }
          setPendingInstall(null);
        }}
        onConfirm={async (selectedPath) => {
          // 用户点击"继续"，确认安装
          if (pendingInstall) {
            try {
              await invoke("confirm_skill_installation", {
                skillId: pendingInstall.skill.id,
                installPath: selectedPath,
              });

              // 保存到最近路径
              addRecentInstallPath(selectedPath);

              console.log('[INFO] 用户确认安装');

              // 刷新技能列表（等待数据重新获取完成）
              await queryClient.refetchQueries({ queryKey: ["skills"] });
              await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
              await queryClient.refetchQueries({ queryKey: ["scanResults"] });

              // 数据刷新完成后显示 toast
              appToast.success(t('skills.toast.installed'));
            } catch (error: any) {
              console.error('[ERROR] 确认安装失败:', error);
              appToast.error(`${t('skills.toast.installFailed')}: ${error.message || error}`);
            }
          }
          setPendingInstall(null);
        }}
        report={pendingInstall?.report || null}
        skillName={pendingInstall?.skill.name || ""}
      />
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  index: number;
  onInstall: () => void;
  onUninstall: () => void;
  onUninstallPath: (path: string) => void;
  onDelete: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  isDeleting: boolean;
  isPreparing: boolean;
  isAnyOperationPending: boolean;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  index,
  onInstall,
  onUninstall,
  onUninstallPath,
  onDelete,
  isInstalling,
  isUninstalling,
  isDeleting,
  isPreparing,
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
          {/* Skill Name with Repository Tag and Status */}
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

            {skill.installed ? (
              <span className="status-installed">{t('skills.installed')}</span>
            ) : isInstalling ? (
              <span className="status-installing">{t('skills.installing')}</span>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          {/* 安装按钮 - 始终显示 */}
          <button
            onClick={onInstall}
            disabled={isAnyOperationPending}
            className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isPreparing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.scanning')}
              </>
            ) : isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.installing')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {skill.installed ? t('skills.installToOther') : t('skills.install')}
              </>
            )}
          </button>

          {/* 卸载/删除按钮 */}
          {skill.installed ? (
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
          ) : (
            <button
              onClick={onDelete}
              disabled={isAnyOperationPending}
              className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title={t('skills.deleteRecord')}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t('skills.delete')}
                </>
              )}
            </button>
          )}
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

interface InstallConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedPath: string) => void;
  report: SecurityReport | null;
  skillName: string;
}

function InstallConfirmDialog({
  open,
  onClose,
  onConfirm,
  report,
  skillName
}: InstallConfirmDialogProps) {
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string>('');

  const isMediumRisk = report ? report.score >= 50 && report.score < 70 : false;
  const isHighRisk = report ? report.score < 50 || report.blocked : false;

  const issueCounts = useMemo(
    () => report ? countIssuesBySeverity(report.issues) : { critical: 0, error: 0, warning: 0 },
    [report]
  );

  if (!report) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-6 h-6 text-red-500" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            {t('skills.marketplace.install.scanResult')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t('skills.marketplace.install.preparingInstall')}: <span className="font-mono font-bold">{skillName}</span>
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
                  <ul className="space-y-1 text-sm font-mono">
                    {report.issues.slice(0, 3).map((issue, idx) => (
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
                  </ul>
                </div>
              )}

              {/* 警告信息 */}
              {isHighRisk && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block mb-1">{t('skills.marketplace.install.warningTitle')}</strong>
                      {t('skills.marketplace.install.warningMessage')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 路径选择器 */}
        <div className="py-4 border-t border-border">
          <InstallPathSelector onSelect={setSelectedPath} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t('skills.marketplace.install.cancel')}</AlertDialogCancel>
          <button
            onClick={() => onConfirm(selectedPath)}
            disabled={!selectedPath}
            className={`px-4 py-2 rounded font-mono disabled:opacity-50 transition-colors ${
              isHighRisk ? 'bg-red-500 hover:bg-red-600' :
              isMediumRisk ? 'bg-yellow-500 hover:bg-yellow-600' :
              'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isHighRisk
              ? t('skills.marketplace.install.installAnyway')
              : t('skills.marketplace.install.confirmInstall')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
