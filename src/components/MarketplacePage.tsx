import { useState, useMemo } from "react";
import { useSkills, useInstallSkill, useUninstallSkill, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { SecurityReport } from "../types/security";
import { Download, Trash2, AlertTriangle, Loader2, Package, Search, ChevronDown, ChevronUp, FolderOpen, XCircle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { countIssuesBySeverity } from "@/lib/security-utils";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";

export function MarketplacePage() {
  const { t, i18n } = useTranslation();
  const { data: allSkills, isLoading } = useSkills();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();
  const deleteMutation = useDeleteSkill();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [hideInstalled, setHideInstalled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
  const [pendingInstall, setPendingInstall] = useState<{
    skill: Skill;
    report: SecurityReport;
  } | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 提取所有仓库及其技能数量
  const repositories = useMemo(() => {
    if (!allSkills) return [];
    const ownerMap = new Map<string, number>();

    allSkills.forEach((skill) => {
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
      { owner: "all", count: allSkills.length, displayName: t('skills.marketplace.allRepos') },
      ...repos
    ];
  }, [allSkills, i18n.language, t]);

  // 转换为 CyberSelect 选项格式
  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  // 筛选逻辑
  const filteredSkills = useMemo(() => {
    if (!allSkills) return [];

    return allSkills.filter((skill) => {
      // 搜索过滤
      const matchesSearch = !searchQuery ||
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // 仓库过滤
      const matchesRepo = selectedRepository === "all" ||
        skill.repository_owner === selectedRepository;

      // 安装状态过滤
      const matchesInstalled = !hideInstalled || !skill.installed;

      return matchesSearch && matchesRepo && matchesInstalled;
    });
  }, [allSkills, searchQuery, selectedRepository, hideInstalled]);

  const getSecurityBadge = (score?: number) => {
    if (!score) return null;

    if (score >= 90) {
      return (
        <span className="status-indicator text-terminal-green border-terminal-green/30 bg-terminal-green/10">
          {t('skills.secure')}_{score}
        </span>
      );
    } else if (score >= 70) {
      return (
        <span className="status-indicator text-terminal-yellow border-terminal-yellow/30 bg-terminal-yellow/10">
          {t('skills.lowRisk')}_{score}
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="status-indicator text-terminal-orange border-terminal-orange/30 bg-terminal-orange/10">
          {t('skills.medRisk')}_{score}
        </span>
      );
    } else {
      return (
        <span className="status-indicator text-terminal-red border-terminal-red/30 bg-terminal-red/10">
          {t('skills.highRisk')}_{score}
        </span>
      );
    }
  };

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
        <div className="grid gap-4">
          {filteredSkills.map((skill, index) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              index={index}
              onInstall={async () => {
                try {
                  setInstallingSkillId(skill.id);

                  // 扫描 Skill（使用已有的 security_score 或进行实时扫描）
                  let report: SecurityReport | null = null;

                  // 如果 skill 已有 local_path，说明已下载，可以直接扫描
                  if (skill.local_path) {
                    try {
                      report = await invoke<SecurityReport>("scan_skill_archive", {
                        archivePath: skill.local_path
                      });
                    } catch (scanError) {
                      console.warn("扫描失败，将继续安装:", scanError);
                    }
                  }

                  // 如果没有扫描报告但有缓存的评分，构造一个简单的报告
                  if (!report && skill.security_score != null) {
                    report = {
                      skill_id: skill.id,
                      score: skill.security_score,
                      level: skill.security_score >= 90 ? "Safe" :
                             skill.security_score >= 70 ? "Low" :
                             skill.security_score >= 50 ? "Medium" : "High",
                      issues: (skill.security_issues || []).map(issue => ({
                        severity: "Warning",
                        category: "Unknown",
                        description: issue
                      })),
                      recommendations: [],
                      blocked: false,
                      hard_trigger_issues: []
                    };
                  }

                  // 判断是否需要用户确认
                  if (report) {
                    // 如果被阻止，显示错误
                    if (report.blocked) {
                      setInstallingSkillId(null);
                      showToast(t('skills.marketplace.install.blocked'));
                      setPendingInstall({ skill, report });
                      return;
                    }

                    // 如果评分低于 70，显示确认对话框
                    if (report.score < 70) {
                      setInstallingSkillId(null);
                      setPendingInstall({ skill, report });
                      return;
                    }
                  }

                  // 安全评分 >= 70 或无扫描结果，直接安装
                  installMutation.mutate(skill.id, {
                    onSuccess: () => {
                      setInstallingSkillId(null);
                      showToast(t('skills.toast.installed'));
                    },
                    onError: (error: any) => {
                      setInstallingSkillId(null);
                      showToast(`${t('skills.toast.installFailed')}: ${error.message || error}`);
                    },
                  });
                } catch (error: any) {
                  setInstallingSkillId(null);
                  showToast(`${t('skills.marketplace.install.preparationFailed')}: ${error.message || error}`);
                }
              }}
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
              onDelete={() => {
                setDeletingSkillId(skill.id);
                deleteMutation.mutate(skill.id, {
                  onSuccess: () => {
                    setDeletingSkillId(null);
                    showToast(t('skills.toast.deleted'));
                  },
                  onError: (error: any) => {
                    setDeletingSkillId(null);
                    showToast(`${t('skills.toast.deleteFailed')}: ${error.message || error}`);
                  },
                });
              }}
              isInstalling={installingSkillId === skill.id}
              isUninstalling={uninstallingSkillId === skill.id}
              isDeleting={deletingSkillId === skill.id}
              isAnyOperationPending={installMutation.isPending || uninstallMutation.isPending || deleteMutation.isPending}
              getSecurityBadge={getSecurityBadge}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg">
          <div className="text-terminal-cyan font-mono text-2xl mb-4">🔍</div>
          <p className="text-sm text-muted-foreground font-mono mb-2">
            {searchQuery
              ? t('skills.marketplace.noResults', { query: searchQuery })
              : t('skills.marketplace.noSkillsInFilter')}
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

      {/* Install Confirmation Dialog */}
      <InstallConfirmDialog
        open={pendingInstall !== null}
        onClose={() => setPendingInstall(null)}
        onConfirm={() => {
          if (pendingInstall) {
            setInstallingSkillId(pendingInstall.skill.id);
            setPendingInstall(null);
            installMutation.mutate(pendingInstall.skill.id, {
              onSuccess: () => {
                setInstallingSkillId(null);
                showToast(t('skills.toast.installed'));
              },
              onError: (error: any) => {
                setInstallingSkillId(null);
                showToast(`${t('skills.toast.installFailed')}: ${error.message || error}`);
              },
            });
          }
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
  onDelete: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  isDeleting: boolean;
  isAnyOperationPending: boolean;
  getSecurityBadge: (score?: number) => React.ReactNode;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  index,
  onInstall,
  onUninstall,
  onDelete,
  isInstalling,
  isUninstalling,
  isDeleting,
  isAnyOperationPending,
  getSecurityBadge,
  t
}: SkillCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showLocalToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const handleOpenFolder = async () => {
    if (!skill.local_path) return;

    try {
      await openPath(skill.local_path);
      showLocalToast(t('skills.folder.opened'));
    } catch (error: any) {
      console.error('[ERROR] Failed to open folder:', error);
      showLocalToast(t('skills.folder.openFailed', { error: error?.message || String(error) }));
    }
  };

  const handleInstallClick = () => {
    if ((skill.security_score != null && skill.security_score < 50) ||
        (skill.security_issues && skill.security_issues.length > 0)) {
      setShowConfirm(true);
    } else {
      onInstall();
    }
  };

  const confirmInstall = () => {
    setShowConfirm(false);
    onInstall();
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
          {/* Skill Name with Repository Tag and Status */}
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

            {skill.installed ? (
              <span className="status-installed">{t('skills.installed')}</span>
            ) : isInstalling ? (
              <span className="status-installing">{t('skills.installing')}</span>
            ) : null}
          </div>

          {/* Security Badge & Score */}
          <div className="flex items-center gap-3 flex-wrap">
            {getSecurityBadge(skill.security_score)}
            {skill.security_score != null && (
              <span className="font-mono text-xs text-muted-foreground">
                {t('skills.score')}: <span className="text-terminal-cyan">{skill.security_score}/100</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          {skill.installed ? (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUninstalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('skills.uninstall')
              )}
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              disabled={isAnyOperationPending}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.installing')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('skills.install')}
                </>
              )}
            </button>
          )}

          <button
            onClick={onDelete}
            disabled={isAnyOperationPending}
            className="px-3 py-2 rounded border border-border bg-card text-muted-foreground hover:border-terminal-red hover:text-terminal-red transition-all duration-200 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
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
          {skill.repository_url.split("/").slice(-2).join("/")}
        </span>
        <span className="text-muted-foreground">
          <span className="text-terminal-purple">{t('skills.path')}</span> {skill.file_path}
        </span>
      </div>

      {/* Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-xs font-mono text-terminal-cyan hover:text-terminal-cyan/80 transition-colors mt-4 group/details"
      >
        {showDetails ? (
          <>
            <ChevronUp className="w-4 h-4 transition-transform group-hover/details:translate-y-[-2px]" />
            {t('skills.collapseDetails')}
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 transition-transform group-hover/details:translate-y-[2px]" />
            {t('skills.expandDetails')}
          </>
        )}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div
          className="mt-4 p-4 bg-muted/50 border border-border rounded space-y-3"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          <DetailItem label={t('skills.fullRepository')} value={skill.repository_url} />
          {skill.version && <DetailItem label={t('skills.version')} value={skill.version} />}
          {skill.author && <DetailItem label={t('skills.author')} value={skill.author} />}
          {skill.local_path && (
            <div className="text-xs font-mono">
              <p className="text-terminal-cyan mb-1">{t('skills.localPath')}:</p>
              <button
                onClick={handleOpenFolder}
                className="text-muted-foreground break-all hover:text-terminal-cyan transition-colors flex items-center gap-2 group"
              >
                <FolderOpen className="w-4 h-4 flex-shrink-0 group-hover:text-terminal-cyan" />
                <span className="text-left">{skill.local_path}</span>
              </button>
            </div>
          )}

          {skill.security_score != null && (
            <div className="text-xs font-mono">
              <p className="text-terminal-cyan mb-1">{t('skills.securityAnalysis')}</p>
              <p className="text-muted-foreground">
                {skill.security_score}/100 {" "}
                {skill.security_score >= 90 && t('skills.safe')}
                {skill.security_score >= 70 && skill.security_score < 90 && t('skills.lowRiskLabel')}
                {skill.security_score >= 50 && skill.security_score < 70 && t('skills.mediumRiskLabel')}
                {skill.security_score < 50 && t('skills.highRiskInstallNotRecommended')}
              </p>
            </div>
          )}

          {skill.security_issues && skill.security_issues.length > 0 && (
            <div className="text-xs font-mono">
              <p className="text-terminal-red mb-2">{t('skills.securityIssuesDetected')}</p>
              <div className="space-y-1 pl-4 border-l-2 border-terminal-red/30">
                {skill.security_issues.map((issue, idx) => (
                  <p key={idx} className="text-muted-foreground">
                    <span className="text-terminal-red">[{idx + 1}]</span> {issue}
                  </p>
                ))}
              </div>
            </div>
          )}

          {skill.installed_at && (
            <DetailItem
              label={t('skills.installedAt')}
              value={new Date(skill.installed_at).toLocaleString('zh-CN')}
            />
          )}
        </div>
      )}

      {/* Risk Confirmation Dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div className="bg-card border-2 border-terminal-orange rounded-lg p-6 max-w-md w-full shadow-2xl"
            style={{ boxShadow: '0 0 30px rgba(251, 146, 60, 0.3)' }}
          >
            <div className="flex items-start gap-4 mb-6">
              <AlertTriangle className="w-8 h-8 text-terminal-orange flex-shrink-0 animate-pulse" />
              <div>
                <h3 className="text-xl font-bold text-terminal-orange mb-2 tracking-wider uppercase">
                  {t('skills.securityWarning')}
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {t('skills.highRiskSkillDetected')}
                </p>
              </div>
            </div>

            {skill.security_score != null && (
              <div className="mb-4 p-3 bg-terminal-orange/10 border border-terminal-orange/30 rounded">
                <p className="text-xs font-mono text-terminal-orange mb-1">{t('skills.securityScore')}</p>
                <p className="text-sm font-mono text-foreground">
                  {skill.security_score}/100
                  {skill.security_score < 50 && ` ${t('skills.criticalRisk')}`}
                  {skill.security_score >= 50 && skill.security_score < 70 && ` ${t('skills.elevatedRisk')}`}
                </p>
              </div>
            )}

            {skill.security_issues && skill.security_issues.length > 0 && (
              <div className="mb-4 p-3 bg-muted border border-border rounded max-h-40 overflow-y-auto">
                <p className="text-xs font-mono text-terminal-red mb-2">{t('skills.detectedIssues')}</p>
                <ul className="text-xs space-y-1 font-mono">
                  {skill.security_issues.slice(0, 5).map((issue, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      <span className="text-terminal-red">[{idx + 1}]</span> {issue}
                    </li>
                  ))}
                  {skill.security_issues.length > 5 && (
                    <li className="text-muted-foreground italic">
                      ... +{skill.security_issues.length - 5} {t('skills.moreIssues')}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground font-mono mb-6 p-3 bg-muted/50 rounded border border-border">
              <span className="text-terminal-orange">[!]</span> {t('skills.installWarning')}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-3 rounded bg-card border border-border text-foreground hover:border-terminal-cyan transition-all font-mono text-sm"
              >
                {t('skills.abort')}
              </button>
              <button
                onClick={confirmInstall}
                className="flex-1 px-4 py-3 rounded bg-terminal-orange border border-terminal-orange text-background hover:bg-terminal-orange/90 transition-all font-mono text-sm font-bold"
              >
                {t('skills.proceedAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}

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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-mono">
      <p className="text-terminal-cyan mb-1">{label}:</p>
      <p className="text-muted-foreground break-all">{value}</p>
    </div>
  );
}

interface InstallConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
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

  if (!report) return null;

  const isMediumRisk = report.score >= 50 && report.score < 70;
  const isHighRisk = report.score < 50 || report.blocked;

  const issueCounts = useMemo(
    () => countIssuesBySeverity(report.issues),
    [report.issues]
  );

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
            <div className="space-y-4">
              <div>
                {t('skills.marketplace.install.preparingInstall')}: <span className="font-mono font-bold">{skillName}</span>
              </div>

              {/* 评分 */}
              <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg">
                <span className="text-sm">{t('skills.marketplace.install.securityScore')}:</span>
                <span className={`text-3xl font-bold font-mono ${
                  report.score >= 90 ? 'text-green-500' :
                  report.score >= 70 ? 'text-yellow-500' :
                  report.score >= 50 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {report.score}
                </span>
              </div>

              {/* 问题摘要 */}
              {report.issues.length > 0 && (
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
              )}

              {/* 建议 */}
              {report.recommendations.length > 0 && (
                <div className={`p-3 rounded-lg ${
                  isHighRisk ? 'bg-red-500/10 border border-red-500/50' :
                  isMediumRisk ? 'bg-yellow-500/10 border border-yellow-500/50' :
                  'bg-green-500/10 border border-green-500/50'
                }`}>
                  <ul className="space-y-1 text-sm">
                    {report.recommendations.slice(0, 3).map((rec, idx) => (
                      <li key={idx}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 警告信息 */}
              {isHighRisk && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-sm">
                  <strong>{t('skills.marketplace.install.warningTitle')}</strong>
                  <br />
                  {t('skills.marketplace.install.warningMessage')}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t('skills.marketplace.install.cancel')}</AlertDialogCancel>
          {!report.blocked && (
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded font-mono ${
                isHighRisk ? 'bg-red-500 hover:bg-red-600' :
                isMediumRisk ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-green-500 hover:bg-green-600'
              } text-white`}
            >
              {isHighRisk ? t('skills.marketplace.install.installAnyway') : isMediumRisk ? t('skills.marketplace.install.installCautiously') : t('skills.marketplace.install.install')}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
