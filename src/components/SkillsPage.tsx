import { useState } from "react";
import { useSkills, useInstallSkill, useUninstallSkill, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { Download, Trash2, AlertTriangle, ChevronDown, ChevronUp, Package, Loader2 } from "lucide-react";

export function SkillsPage() {
  const { data: skills, isLoading } = useSkills();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();
  const deleteMutation = useDeleteSkill();

  const [filter, setFilter] = useState<"all" | "installed" | "not-installed">("all");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredSkills = skills?.filter((skill) => {
    if (filter === "installed") return skill.installed;
    if (filter === "not-installed") return !skill.installed;
    return true;
  });

  const getSecurityBadge = (score?: number) => {
    if (!score) return null;

    if (score >= 90) {
      return (
        <span className="status-indicator text-terminal-green border-terminal-green/30 bg-terminal-green/10">
          SECURE_{score}
        </span>
      );
    } else if (score >= 70) {
      return (
        <span className="status-indicator text-terminal-yellow border-terminal-yellow/30 bg-terminal-yellow/10">
          LOWRISK_{score}
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="status-indicator text-terminal-orange border-terminal-orange/30 bg-terminal-orange/10">
          MEDRISK_{score}
        </span>
      );
    } else {
      return (
        <span className="status-indicator text-terminal-red border-terminal-red/30 bg-terminal-red/10">
          HIGHRISK_{score}
        </span>
      );
    }
  };

  return (
    <div className="space-y-6" style={{ animation: 'slideInLeft 0.5s ease-out' }}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-lg text-terminal-cyan tracking-wider flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span>SKILL_DATABASE</span>
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            <span className="text-terminal-green">&gt;</span> {filteredSkills?.length || 0} TOTAL_ENTRIES
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`
              px-4 py-2 rounded font-mono text-xs transition-all duration-200
              ${filter === "all"
                ? "bg-terminal-cyan text-background border border-terminal-cyan shadow-[0_0_10px_rgba(94,234,212,0.3)]"
                : "bg-card border border-border text-muted-foreground hover:border-terminal-cyan hover:text-terminal-cyan"
              }
            `}
          >
            ALL [{skills?.length || 0}]
          </button>
          <button
            onClick={() => setFilter("installed")}
            className={`
              px-4 py-2 rounded font-mono text-xs transition-all duration-200
              ${filter === "installed"
                ? "bg-terminal-green text-background border border-terminal-green shadow-[0_0_10px_rgba(74,222,128,0.3)]"
                : "bg-card border border-border text-muted-foreground hover:border-terminal-green hover:text-terminal-green"
              }
            `}
          >
            INSTALLED [{skills?.filter((s) => s.installed).length || 0}]
          </button>
          <button
            onClick={() => setFilter("not-installed")}
            className={`
              px-4 py-2 rounded font-mono text-xs transition-all duration-200
              ${filter === "not-installed"
                ? "bg-terminal-purple text-background border border-terminal-purple shadow-[0_0_10px_rgba(192,132,252,0.3)]"
                : "bg-card border border-border text-muted-foreground hover:border-terminal-purple hover:text-terminal-purple"
              }
            `}
          >
            AVAILABLE [{skills?.filter((s) => !s.installed).length || 0}]
          </button>
        </div>
      </div>

      {/* Skills Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-terminal-cyan animate-spin mb-4" />
          <p className="text-sm font-mono text-terminal-cyan terminal-cursor">LOADING_SKILLS_DATABASE</p>
        </div>
      ) : filteredSkills && filteredSkills.length > 0 ? (
        <div className="grid gap-4">
          {filteredSkills.map((skill, index) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              index={index}
              onInstall={() => {
                installMutation.mutate(skill.id, {
                  onSuccess: () => showToast("[SUCCESS] SKILL_INSTALLED"),
                  onError: (error: any) => showToast(`[ERROR] INSTALL_FAILED: ${error.message || error}`),
                });
              }}
              onUninstall={() => {
                uninstallMutation.mutate(skill.id, {
                  onSuccess: () => showToast("[SUCCESS] SKILL_UNINSTALLED"),
                  onError: (error: any) => showToast(`[ERROR] UNINSTALL_FAILED: ${error.message || error}`),
                });
              }}
              onDelete={() => {
                deleteMutation.mutate(skill.id, {
                  onSuccess: () => showToast("[SUCCESS] RECORD_DELETED"),
                  onError: (error: any) => showToast(`[ERROR] DELETE_FAILED: ${error.message || error}`),
                });
              }}
              isInstalling={installMutation.isPending}
              isUninstalling={uninstallMutation.isPending}
              isDeleting={deleteMutation.isPending}
              getSecurityBadge={getSecurityBadge}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg">
          <div className="text-terminal-cyan font-mono text-2xl mb-4">[ EMPTY ]</div>
          <p className="text-sm text-muted-foreground font-mono">NO_SKILLS_FOUND</p>
          <p className="text-xs text-muted-foreground font-mono mt-2">
            <span className="text-terminal-green">&gt;</span> Navigate to REPO_CONFIG to scan repositories
          </p>
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
  onInstall: () => void;
  onUninstall: () => void;
  onDelete: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  isDeleting: boolean;
  getSecurityBadge: (score?: number) => React.ReactNode;
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
  getSecurityBadge
}: SkillCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
          {/* Skill Name with Status */}
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-bold text-foreground tracking-wide uppercase">
              {skill.name}
            </h3>
            {skill.installed ? (
              <span className="status-installed">INSTALLED</span>
            ) : isInstalling ? (
              <span className="status-installing">INSTALLING</span>
            ) : null}
          </div>

          {/* Security Badge & Score */}
          <div className="flex items-center gap-3 flex-wrap">
            {getSecurityBadge(skill.security_score)}
            {skill.security_score != null && (
              <span className="font-mono text-xs text-muted-foreground">
                SCORE: <span className="text-terminal-cyan">{skill.security_score}/100</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          {skill.installed ? (
            <button
              onClick={onUninstall}
              disabled={isUninstalling}
              className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUninstalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "UNINSTALL"
              )}
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  INSTALLING
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  INSTALL
                </>
              )}
            </button>
          )}

          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="px-3 py-2 rounded border border-border bg-card text-muted-foreground hover:border-terminal-red hover:text-terminal-red transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3 font-mono">
        {skill.description || "[NO_DESCRIPTION_PROVIDED]"}
      </p>

      {/* Repository Info */}
      <div className="flex items-center gap-4 mb-3 text-xs font-mono">
        <span className="text-muted-foreground">
          <span className="text-terminal-green">REPO:</span>{" "}
          {skill.repository_url.split("/").slice(-2).join("/")}
        </span>
        <span className="text-muted-foreground">
          <span className="text-terminal-purple">PATH:</span> {skill.file_path}
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
            COLLAPSE_DETAILS
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4 transition-transform group-hover/details:translate-y-[2px]" />
            EXPAND_DETAILS
          </>
        )}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div
          className="mt-4 p-4 bg-muted/50 border border-border rounded space-y-3"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          <DetailItem label="FULL_REPOSITORY" value={skill.repository_url} />
          {skill.version && <DetailItem label="VERSION" value={skill.version} />}
          {skill.author && <DetailItem label="AUTHOR" value={skill.author} />}
          {skill.local_path && <DetailItem label="LOCAL_PATH" value={skill.local_path} />}

          {skill.security_score != null && (
            <div className="text-xs font-mono">
              <p className="text-terminal-cyan mb-1">SECURITY_ANALYSIS:</p>
              <p className="text-muted-foreground">
                {skill.security_score}/100 {" "}
                {skill.security_score >= 90 && "[SAFE]"}
                {skill.security_score >= 70 && skill.security_score < 90 && "[LOW_RISK]"}
                {skill.security_score >= 50 && skill.security_score < 70 && "[MEDIUM_RISK]"}
                {skill.security_score < 50 && "[HIGH_RISK - INSTALLATION_NOT_RECOMMENDED]"}
              </p>
            </div>
          )}

          {skill.security_issues && skill.security_issues.length > 0 && (
            <div className="text-xs font-mono">
              <p className="text-terminal-red mb-2">SECURITY_ISSUES_DETECTED:</p>
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
              label="INSTALLED_AT"
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
                  SECURITY_WARNING
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  HIGH_RISK_SKILL_DETECTED
                </p>
              </div>
            </div>

            {skill.security_score != null && (
              <div className="mb-4 p-3 bg-terminal-orange/10 border border-terminal-orange/30 rounded">
                <p className="text-xs font-mono text-terminal-orange mb-1">SECURITY_SCORE:</p>
                <p className="text-sm font-mono text-foreground">
                  {skill.security_score}/100
                  {skill.security_score < 50 && " [CRITICAL_RISK]"}
                  {skill.security_score >= 50 && skill.security_score < 70 && " [ELEVATED_RISK]"}
                </p>
              </div>
            )}

            {skill.security_issues && skill.security_issues.length > 0 && (
              <div className="mb-4 p-3 bg-muted border border-border rounded max-h-40 overflow-y-auto">
                <p className="text-xs font-mono text-terminal-red mb-2">DETECTED_ISSUES:</p>
                <ul className="text-xs space-y-1 font-mono">
                  {skill.security_issues.slice(0, 5).map((issue, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      <span className="text-terminal-red">[{idx + 1}]</span> {issue}
                    </li>
                  ))}
                  {skill.security_issues.length > 5 && (
                    <li className="text-muted-foreground italic">
                      ... +{skill.security_issues.length - 5} MORE_ISSUES
                    </li>
                  )}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground font-mono mb-6 p-3 bg-muted/50 rounded border border-border">
              <span className="text-terminal-orange">[!]</span> Installing this skill may compromise system security.
              Verify source authenticity before proceeding.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-3 rounded bg-card border border-border text-foreground hover:border-terminal-cyan transition-all font-mono text-sm"
              >
                ABORT
              </button>
              <button
                onClick={confirmInstall}
                className="flex-1 px-4 py-3 rounded bg-terminal-orange border border-terminal-orange text-background hover:bg-terminal-orange/90 transition-all font-mono text-sm font-bold"
              >
                PROCEED_ANYWAY
              </button>
            </div>
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
