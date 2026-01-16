import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSkills, useInstallSkill, useUninstallSkill, useUninstallSkillPath, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { SecurityReport } from "../types/security";
import { Download, Trash2, AlertTriangle, Loader2, Search, FolderOpen, XCircle, CheckCircle } from "lucide-react";
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

  const repositorySkills = useMemo(() => {
    if (!allSkills) return [];
    return allSkills.filter(skill => skill.repository_owner !== "local");
  }, [allSkills]);

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

  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  const filteredSkills = useMemo(() => {
    if (!repositorySkills) return [];

    const query = searchQuery.toLowerCase();

    let filtered = repositorySkills.filter((skill) => {
      const matchesRepo = selectedRepository === "all" ||
        skill.repository_owner === selectedRepository;
      const matchesInstalled = !hideInstalled || !skill.installed;
      const matchesSearch = !searchQuery ||
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query);

      return matchesSearch && matchesRepo && matchesInstalled;
    });

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

      filtered = [...nameMatches, ...descriptionMatches];
    }

    return filtered;
  }, [repositorySkills, searchQuery, selectedRepository, hideInstalled]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline text-foreground">{t('nav.marketplace')}</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('skills.marketplace.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input w-full h-10 pl-10 pr-4"
            />
          </div>

          <CyberSelect
            value={selectedRepository}
            onChange={setSelectedRepository}
            options={repositoryOptions}
            className="min-w-[200px]"
          />

          <label className="flex items-center gap-2 h-10 px-4 apple-card text-sm cursor-pointer hover:bg-secondary/50 transition-colors">
            <input
              type="checkbox"
              checked={hideInstalled}
              onChange={(e) => setHideInstalled(e.target.checked)}
              className="rounded border-border accent-blue-500"
            />
            <span>{t('skills.marketplace.hideInstalled')}</span>
          </label>
        </div>
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">{t('skills.loading')}</p>
        </div>
      ) : filteredSkills && filteredSkills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onInstall={async () => {
                try {
                  setPreparingSkillId(skill.id);
                  const report = await invoke<SecurityReport>("prepare_skill_installation", {
                    skillId: skill.id,
                    locale: i18n.language,
                  });
                  setPreparingSkillId(null);
                  setPendingInstall({ skill, report });
                } catch (error: any) {
                  setPreparingSkillId(null);
                  appToast.error(`${t('skills.toast.installFailed')}: ${error.message || error}`);
                }
              }}
              onUninstall={() => {
                uninstallMutation.mutate(skill.id, {
                  onSuccess: () => appToast.success(t('skills.toast.uninstalled')),
                  onError: (error: any) => appToast.error(`${t('skills.toast.uninstallFailed')}: ${error.message || error}`),
                });
              }}
              onUninstallPath={(path: string) => {
                uninstallPathMutation.mutate({ skillId: skill.id, path }, {
                  onSuccess: () => appToast.success(t('skills.toast.uninstalled')),
                  onError: (error: any) => appToast.error(`${t('skills.toast.uninstallFailed')}: ${error.message || error}`),
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
        <div className="apple-card p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          {searchQuery ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {t('skills.marketplace.noResults', { query: searchQuery })}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRepository("all");
                  setHideInstalled(false);
                }}
                className="apple-button-secondary"
              >
                {t('skills.marketplace.clearFilters')}
              </button>
            </>
          ) : repositorySkills.length === 0 ? (
            <div className="max-w-md mx-auto">
              <p className="text-sm text-muted-foreground mb-2">
                {t('skills.marketplace.noSkillsYet')}
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {t('skills.marketplace.scanningRepositories')}
              </p>
              <button
                onClick={() => onNavigateToRepositories?.()}
                disabled={!onNavigateToRepositories}
                className="apple-button-primary disabled:opacity-50"
              >
                {t('skills.marketplace.goToRepositories')}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {t('skills.marketplace.noSkillsInFilter')}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedRepository("all");
                  setHideInstalled(false);
                }}
                className="apple-button-secondary"
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
          if (pendingInstall) {
            try {
              await invoke("cancel_skill_installation", { skillId: pendingInstall.skill.id });
            } catch (error: any) {
              console.error('[ERROR] 取消安装失败:', error);
            }
          }
          setPendingInstall(null);
        }}
        onConfirm={async (selectedPath) => {
          if (pendingInstall) {
            try {
              await invoke("confirm_skill_installation", {
                skillId: pendingInstall.skill.id,
                installPath: selectedPath,
              });
              addRecentInstallPath(selectedPath);
              await queryClient.refetchQueries({ queryKey: ["skills"] });
              await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
              await queryClient.refetchQueries({ queryKey: ["scanResults"] });
              appToast.success(t('skills.toast.installed'));
            } catch (error: any) {
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
    <div className="apple-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium text-foreground">{skill.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              skill.repository_owner === "local"
                ? "bg-muted text-muted-foreground"
                : "bg-blue-500/10 text-blue-600"
            }`}>
              {formatRepositoryTag(skill)}
            </span>
            {skill.installed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                {t('skills.installed')}
              </span>
            )}
            {isInstalling && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                {t('skills.installing')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onInstall}
            disabled={isAnyOperationPending}
            className="apple-button-primary h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPreparing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{t('skills.scanning')}</span>
              </>
            ) : isInstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{t('skills.installing')}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{skill.installed ? t('skills.installToOther') : t('skills.install')}</span>
              </>
            )}
          </button>

          {skill.installed && (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{t('skills.uninstalling')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('skills.uninstallAll')}</span>
                </>
              )}
            </button>
          )}
          {/* 删除按钮暂时隐藏，功能未开放 */}
          {/* {!skill.installed && (
            <button
              onClick={onDelete}
              disabled={isAnyOperationPending}
              className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
              title={t('skills.deleteRecord')}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{t('skills.deleting')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('skills.delete')}</span>
                </>
              )}
            </button>
          )} */}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3">
        {skill.description || t('skills.noDescription')}
      </p>

      {/* Repository */}
      <div className="text-xs text-muted-foreground mb-3">
        <span className="text-blue-500 font-medium">{t('skills.repo')}</span>{" "}
        {skill.repository_url === "local" ? (
          <span>{skill.repository_url}</span>
        ) : (
          <a
            href={skill.repository_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 hover:underline break-all transition-colors"
          >
            {skill.repository_url}
          </a>
        )}
      </div>

      {/* Installed Paths */}
      {skill.local_paths && skill.local_paths.length > 0 && (
        <div className="pt-3 border-t border-border/60">
          <div className="text-xs text-muted-foreground mb-2">
            <span className="text-blue-500 font-medium">{t('skills.installedPaths')}</span> ({skill.local_paths.length})
          </div>
          <div className="space-y-1.5">
            {skill.local_paths.map((path, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2.5 bg-secondary/50 rounded-xl text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={async () => {
                      try {
                        await openPath(path);
                        appToast.success(t('skills.folder.opened'), { duration: 5000 });
                      } catch (error: any) {
                        appToast.error(t('skills.folder.openFailed', { error: error?.message || String(error) }), { duration: 5000 });
                      }
                    }}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                    title={t('skills.openFolder')}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-muted-foreground truncate" title={path}>{path}</span>
                </div>
                <button
                  onClick={() => onUninstallPath(path)}
                  disabled={isAnyOperationPending}
                  className="text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  title={t('skills.uninstallPath')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
              <XCircle className="w-5 h-5 text-destructive" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
            {t('skills.marketplace.install.scanResult')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t('skills.marketplace.install.preparingInstall')}: <span className="font-semibold">{skillName}</span>
              </div>

              {/* Score */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm">{t('skills.marketplace.install.securityScore')}:</span>
                <span className={`text-3xl font-bold ${
                  report.score >= 90 ? 'text-success' :
                  report.score >= 70 ? 'text-success' :
                  report.score >= 50 ? 'text-warning' : 'text-destructive'
                }`}>
                  {report.score}
                </span>
              </div>

              {/* Issue Summary */}
              {report.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{t('skills.marketplace.install.issuesDetected')}:</div>
                  <div className="flex gap-4 text-sm">
                    {issueCounts.critical > 0 && (
                      <span className="text-destructive">
                        {t('skills.marketplace.install.critical')}: {issueCounts.critical}
                      </span>
                    )}
                    {issueCounts.error > 0 && (
                      <span className="text-warning">
                        {t('skills.marketplace.install.highRisk')}: {issueCounts.error}
                      </span>
                    )}
                    {issueCounts.warning > 0 && (
                      <span className="text-warning">
                        {t('skills.marketplace.install.mediumRisk')}: {issueCounts.warning}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Issue List */}
              {report.issues.length > 0 && (
                <div className={`p-3 rounded-lg ${
                  isHighRisk ? 'bg-destructive/10 border border-destructive/30' :
                  isMediumRisk ? 'bg-warning/10 border border-warning/30' :
                  'bg-success/10 border border-success/30'
                }`}>
                  <ul className="space-y-1 text-sm">
                    {report.issues.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="text-xs">
                        {issue.file_path && (
                          <span className="text-primary mr-1.5">[{issue.file_path}]</span>
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

              {/* Warning */}
              {isHighRisk && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
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

        {/* Path Selector */}
        <div className="py-4 border-t border-border">
          <InstallPathSelector onSelect={setSelectedPath} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t('skills.marketplace.install.cancel')}</AlertDialogCancel>
          <button
            onClick={() => onConfirm(selectedPath)}
            disabled={!selectedPath}
            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
              isHighRisk ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' :
              isMediumRisk ? 'bg-warning text-warning-foreground hover:bg-warning/90' :
              'bg-success text-success-foreground hover:bg-success/90'
            }`}
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
