import { useState, useMemo } from "react";
import { useInstalledSkills, useUninstallSkill, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { Trash2, Loader2, FolderOpen, Package, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";

export function InstalledSkillsPage() {
  const { t } = useTranslation();
  const { data: installedSkills, isLoading } = useInstalledSkills();
  const uninstallMutation = useUninstallSkill();
  const deleteMutation = useDeleteSkill();

  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 搜索过滤
  const filteredSkills = useMemo(() => {
    if (!installedSkills) return [];
    if (!searchQuery) return installedSkills;

    const query = searchQuery.toLowerCase();
    return installedSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query)
    );
  }, [installedSkills, searchQuery]);

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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('skills.installedPage.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan transition-colors"
          />
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
              isUninstalling={uninstallingSkillId === skill.id}
              isDeleting={deletingSkillId === skill.id}
              isAnyOperationPending={uninstallMutation.isPending || deleteMutation.isPending}
              getSecurityBadge={getSecurityBadge}
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
  onDelete: () => void;
  isUninstalling: boolean;
  isDeleting: boolean;
  isAnyOperationPending: boolean;
  getSecurityBadge: (score?: number) => React.ReactNode;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  index,
  onUninstall,
  onDelete,
  isUninstalling,
  isDeleting,
  isAnyOperationPending,
  getSecurityBadge,
  t
}: SkillCardProps) {
  const [showDetails, setShowDetails] = useState(false);
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

            <span className="status-installed">{t('skills.installed')}</span>
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
