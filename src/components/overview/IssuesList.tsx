import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  Eye,
  CheckCircle,
} from "lucide-react";
import type { SkillScanResult } from "@/types/security";
import { SecurityDetailDialog } from "../SecurityDetailDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface IssuesListProps {
  issues: SkillScanResult[];
  onOpenDirectory: (localPath: string) => void;
}

const levelConfig = {
  Critical: {
    color: "text-terminal-red",
    bg: "bg-terminal-red/10",
    icon: AlertTriangle,
    accentBar: "bg-terminal-red",
  },
  Medium: {
    color: "text-terminal-yellow",
    bg: "bg-terminal-yellow/10",
    icon: AlertCircle,
    accentBar: "bg-terminal-yellow",
  },
  Safe: {
    color: "text-terminal-green",
    bg: "bg-terminal-green/10",
    icon: Info,
    accentBar: "bg-terminal-green",
  },
};

// 将原始的4级分类映射到3级
const mapSeverityTo3Levels = (severity: string): keyof typeof levelConfig => {
  if (severity === "Critical" || severity === "High") {
    return "Critical";
  } else if (severity === "Medium" || severity === "Low") {
    return "Medium";
  }
  return "Safe";
};

const getScoreColor = (score: number) => {
  if (score >= 90) return "text-terminal-green";
  if (score >= 70) return "text-terminal-yellow";
  if (score >= 50) return "text-terminal-orange";
  return "text-terminal-red";
};

export function IssuesList({ issues, onOpenDirectory }: IssuesListProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  const [selectedSkill, setSelectedSkill] = useState<SkillScanResult | null>(null);

  const toggleExpanded = (skillId: string) => {
    setExpandedSkills((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(skillId)) {
        newSet.delete(skillId);
      } else {
        newSet.add(skillId);
      }
      return newSet;
    });
  };

  // 卸载 mutation
  const uninstallMutation = useMutation({
    mutationFn: async (skillId: string) => {
      return await api.uninstallSkill(skillId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      toast.success(t("skills.toast.uninstalled"), {
        duration: 3000,
        style: {
          background: "rgba(6, 182, 212, 0.1)",
          border: "2px solid rgb(6, 182, 212)",
          backdropFilter: "blur(8px)",
          color: "rgb(94, 234, 212)",
          fontFamily: "monospace",
          fontSize: "14px",
          boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
        },
      });
    },
    onError: (error: Error) => {
      toast.error(t("skills.toast.uninstallFailed") + `: ${error.message}`, {
        duration: 4000,
        style: {
          background: "rgba(239, 68, 68, 0.1)",
          border: "2px solid rgb(239, 68, 68)",
          backdropFilter: "blur(8px)",
          color: "rgb(252, 165, 165)",
          fontFamily: "monospace",
          fontSize: "14px",
          boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)",
        },
      });
    },
  });

  const handleUninstall = (skillId: string) => {
    uninstallMutation.mutate(skillId);
  };

  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => {
        const isExpanded = expandedSkills.has(issue.skill_id);
        const LevelIcon = levelConfig[issue.level as keyof typeof levelConfig]?.icon || AlertCircle;
        const levelColorClass = levelConfig[issue.level as keyof typeof levelConfig]?.color || "";
        const levelBgClass = levelConfig[issue.level as keyof typeof levelConfig]?.bg || "";

        // 统计各等级问题数量（映射到3级分类）
        const issueStats = issue.report.issues.reduce(
          (acc, item) => {
            const mappedSeverity = mapSeverityTo3Levels(item.severity);
            acc[mappedSeverity] = (acc[mappedSeverity] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // 获取最严重的前 3 个问题（先去重，使用 description + file_path 作为唯一标识）
        const uniqueIssues = Array.from(
          new Map(
            issue.report.issues.map((item) => [
              `${item.file_path || ""}::${item.description}`,
              item,
            ])
          ).values()
        );
        const topIssues = uniqueIssues
          .sort((a, b) => {
            const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Safe: 4 };
            return (
              (severityOrder[a.severity as keyof typeof severityOrder] || 999) -
              (severityOrder[b.severity as keyof typeof severityOrder] || 999)
            );
          })
          .slice(0, 3);

        return (
          <div
            key={issue.skill_id}
            className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg hover:border-terminal-cyan/30 transition-all duration-300 relative"
            style={{
              animation: `fadeIn 0.4s ease-out ${index * 0.05}s`,
              animationFillMode: "backwards",
            }}
          >
            {/* 左侧风险等级指示条 */}
            <div
              className={`absolute top-0 left-0 w-1 h-full ${levelConfig[issue.level as keyof typeof levelConfig]?.accentBar} opacity-70`}
            ></div>

            {/* 顶部角落装饰 */}
            <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-border/20 rounded-tr-lg"></div>

            {/* 顶部栏 */}
            <div className="p-4 border-b border-border/50 relative pl-5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {/* 左侧：技能名称 + 风险等级 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-mono font-bold text-base text-foreground truncate">
                      {issue.skill_name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${levelBgClass} ${levelColorClass} border border-current/20`}
                    >
                      <LevelIcon className="w-3.5 h-3.5" />
                      {t(`overview.riskLevels.${issue.level.toLowerCase()}`)}
                    </span>
                  </div>
                </div>

                {/* 中间：安全评分 */}
                <div className="flex-shrink-0">
                  <div className={`text-xs font-mono ${getScoreColor(issue.score)}`}>
                    {t("skills.securityScore")}：
                    <span className="text-lg font-bold">{issue.score}</span>
                  </div>
                </div>

                {/* 右侧：操作按钮 */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const skill = issues.find((i) => i.skill_id === issue.skill_id);
                      if (skill) {
                        onOpenDirectory(issue.skill_id);
                      }
                    }}
                    className="
                      relative overflow-hidden group
                      px-2.5 py-1.5 text-xs
                      bg-terminal-cyan/10
                      text-terminal-cyan
                      border border-terminal-cyan/30
                      rounded font-medium font-mono
                      hover:bg-terminal-cyan/20 hover:border-terminal-cyan/60 hover:shadow-lg hover:shadow-terminal-cyan/20
                      transition-all duration-200
                      flex items-center gap-1.5
                    "
                    title={t("overview.issues.openDirectory")}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-terminal-cyan/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <FolderOpen className="w-3.5 h-3.5 relative z-10" />
                    <span className="hidden sm:inline relative z-10">
                      {t("overview.issues.openDirectory")}
                    </span>
                  </button>

                  <button
                    onClick={() => handleUninstall(issue.skill_id)}
                    disabled={uninstallMutation.isPending}
                    className="
                      relative overflow-hidden group
                      px-2.5 py-1.5 text-xs
                      bg-terminal-red/10
                      text-terminal-red
                      border border-terminal-red/30
                      rounded font-medium font-mono
                      hover:bg-terminal-red/20 hover:border-terminal-red/60 hover:shadow-lg hover:shadow-terminal-red/20
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-200
                      flex items-center gap-1.5
                    "
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-terminal-red/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500"></div>
                    <Trash2 className="w-3.5 h-3.5 relative z-10" />
                    <span className="hidden sm:inline relative z-10">
                      {t("overview.issues.uninstall")}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* 问题预览区 */}
            <div className="p-4 bg-muted/20 relative pl-5">
              {/* 如果是安全的技能（0个问题），显示简单的安全状态 */}
              {issue.report.issues.length === 0 ? (
                <div className="flex items-center gap-3 text-sm text-terminal-green font-mono">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{t("overview.issues.skillSafe")}</span>
                </div>
              ) : !isExpanded ? (
                // 折叠状态：显示摘要
                <div
                  onClick={() => toggleExpanded(issue.skill_id)}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/40 -m-2 p-2.5 rounded transition-all duration-200 group"
                >
                  <div className="text-xs text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                    {t("overview.issues.found", {
                      count: issue.report.issues.length,
                      breakdown: Object.entries(issueStats)
                        .map(([severity, count]) =>
                          t("overview.issues.issueCount", {
                            count,
                            level: t(`security.levels.${severity.toLowerCase()}`),
                          })
                        )
                        .join("，"),
                    })}
                  </div>
                  <ChevronDown className="w-5 h-5 text-terminal-cyan group-hover:translate-y-0.5 transition-transform" />
                </div>
              ) : (
                // 展开状态：显示前 3 个问题
                <div className="space-y-2.5">
                  <div
                    onClick={() => toggleExpanded(issue.skill_id)}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/40 -m-2 p-2.5 rounded transition-all duration-200 mb-2 group"
                  >
                    <div className="text-xs font-medium text-foreground font-mono">
                      {
                        t("overview.issues.found", {
                          count: issue.report.issues.length,
                          breakdown: "",
                        }).split("：")[0]
                      }
                    </div>
                    <ChevronUp className="w-5 h-5 text-terminal-cyan group-hover:-translate-y-0.5 transition-transform" />
                  </div>

                  {topIssues.map((item, idx) => {
                    const mappedSeverity = mapSeverityTo3Levels(item.severity);
                    const IssueIcon = levelConfig[mappedSeverity]?.icon || AlertCircle;
                    const issueColor = levelConfig[mappedSeverity]?.color || "";

                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 text-xs p-2.5 rounded bg-card/50 border border-border/30 hover:border-border/60 transition-all"
                      >
                        <IssueIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${issueColor}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground line-clamp-2 font-mono text-xs">
                            {item.file_path && (
                              <span className="text-terminal-cyan mr-1.5">[{item.file_path}]</span>
                            )}
                            {item.description}
                          </span>
                          {item.line_number && (
                            <span className="text-muted-foreground text-[11px] ml-2 font-mono">
                              (行 {item.line_number})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {issue.report.issues.length > 3 && (
                    <button
                      onClick={() => setSelectedSkill(issue)}
                      className="text-xs text-terminal-cyan hover:text-terminal-cyan/80 font-medium font-mono uppercase tracking-wide hover:underline transition-all flex items-center gap-2 group"
                    >
                      <span>{t("overview.issues.viewFullReport")}</span>
                      <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 安全详情对话框 */}
      <SecurityDetailDialog
        result={selectedSkill}
        open={selectedSkill !== null}
        onClose={() => setSelectedSkill(null)}
      />
    </div>
  );
}
