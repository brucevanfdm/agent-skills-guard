import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, Shield, X } from "lucide-react";
import type { SkillScanResult } from "@/types/security";
import type { Skill, Repository } from "@/types";
import { api } from "@/lib/api";
import { StatisticsCards } from "./overview/StatisticsCards";
import { ScanStatusCard } from "./overview/ScanStatusCard";
import { IssuesSummaryCard } from "./overview/IssuesSummaryCard";
import { IssuesList } from "./overview/IssuesList";
import { toast } from "sonner";

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);

  // 获取已安装技能
  const { data: installedSkills = [] } = useQuery<Skill[]>({
    queryKey: ["skills", "installed"],
    queryFn: api.getInstalledSkills,
  });

  // 获取仓库列表
  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["repositories"],
    queryFn: api.getRepositories,
  });

  // 获取扫描结果
  const { data: scanResults = [], isLoading } = useQuery<SkillScanResult[]>({
    queryKey: ["scanResults"],
    queryFn: async () => {
      return await invoke("get_scan_results");
    },
  });

  // 扫描 mutation - 先扫描本地技能，然后进行安全扫描
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);

      let localSkillsCount = 0;

      // 第一步：扫描本地技能目录，刷新技能列表
      try {
        const localSkills = await api.scanLocalSkills();
        localSkillsCount = localSkills.length;
        console.log(`扫描到 ${localSkillsCount} 个本地技能`);

        // 重新获取技能列表并等待完成
        await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
        await queryClient.refetchQueries({ queryKey: ["skills"] });
      } catch (error: any) {
        console.error("扫描本地技能失败:", error);
        toast.error(t("overview.scan.localSkillsFailed", { error: error.message }), {
          duration: 4000,
          style: {
            background: "rgba(239, 68, 68, 0.1)",
            border: "2px solid rgb(239, 68, 68)",
            backdropFilter: "blur(8px)",
            color: "rgb(252, 165, 165)",
            fontFamily: "inherit",
            fontSize: "14px",
            boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)",
          },
        });
      }

      // 第二步：对所有已安装技能进行安全扫描
      const results = await invoke<SkillScanResult[]>("scan_all_installed_skills", {
        locale: i18n.language,
      });

      return { results, localSkillsCount };
    },
    onSuccess: ({ results, localSkillsCount }) => {
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });

      // 显示合并的成功提示
      toast.success(
        t("overview.scan.allCompleted", {
          localCount: localSkillsCount,
          scannedCount: results.length,
        }),
        {
          duration: 4000,
          style: {
            background: "rgba(6, 182, 212, 0.1)",
            border: "2px solid rgb(6, 182, 212)",
            backdropFilter: "blur(8px)",
            color: "rgb(94, 234, 212)",
            fontFamily: "inherit",
            fontSize: "14px",
            boxShadow: "0 0 30px rgba(6, 182, 212, 0.3)",
          },
        }
      );
    },
    onError: (error: any) => {
      toast.error(t("overview.scan.failed", { error: error.message }), {
        duration: 4000,
        style: {
          background: "rgba(239, 68, 68, 0.1)",
          border: "2px solid rgb(239, 68, 68)",
          backdropFilter: "blur(8px)",
          color: "rgb(252, 165, 165)",
          fontFamily: "inherit",
          fontSize: "14px",
          boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)",
        },
      });
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  // 统计数据
  const statistics = useMemo(
    () => ({
      installedCount: installedSkills.length,
      repositoryCount: repositories.length,
      scannedCount: scanResults.length,
    }),
    [installedSkills, repositories, scanResults]
  );

  // 按风险等级统计问题（简化为3级：Critical、Medium、Safe）
  const issuesByLevel = useMemo(() => {
    const result: Record<string, number> = {
      Critical: 0,
      Medium: 0,
      Safe: 0,
    };

    scanResults.forEach((r) => {
      // 将 High 和 Critical 合并为 Critical
      if (r.level === "Critical" || r.level === "High") {
        result.Critical++;
      }
      // 将 Low 和 Medium 合并为 Medium
      else if (r.level === "Medium" || r.level === "Low") {
        result.Medium++;
      }
      // Safe 保持不变
      else if (r.level === "Safe") {
        result.Safe++;
      }
    });

    return result;
  }, [scanResults]);

  // 最后扫描时间
  const lastScanTime = useMemo(() => {
    if (!scanResults.length) return null;
    return new Date(Math.max(...scanResults.map((r) => new Date(r.scanned_at).getTime())));
  }, [scanResults]);

  // 问题数量（非 Safe 的技能）
  const issueCount = useMemo(() => {
    return scanResults.filter((r) => r.level !== "Safe").length;
  }, [scanResults]);

  // 过滤后的问题列表
  const filteredIssues = useMemo(() => {
    return scanResults
      .filter((result) => {
        // 默认只显示有问题的技能
        if (!filterLevel && result.level === "Safe") return false;
        // 如果选择了过滤等级
        if (filterLevel && result.level !== filterLevel) return false;
        return true;
      })
      .sort((a, b) => {
        // 按风险等级排序：Critical > High > Medium > Low
        const levelOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Safe: 4 };
        return (
          (levelOrder[a.level as keyof typeof levelOrder] || 999) -
          (levelOrder[b.level as keyof typeof levelOrder] || 999)
        );
      });
  }, [scanResults, filterLevel]);

  // 打开技能目录
  const handleOpenDirectory = async (skillId: string) => {
    try {
      // 从已安装技能中查找 local_path
      const skill = installedSkills.find((s) => s.id === skillId);
      if (skill?.local_path) {
        await invoke("open_skill_directory", { localPath: skill.local_path });
      } else {
        toast.error("无法找到技能路径", {
          duration: 4000,
          style: {
            background: "rgba(239, 68, 68, 0.1)",
            border: "2px solid rgb(239, 68, 68)",
            backdropFilter: "blur(8px)",
            color: "rgb(252, 165, 165)",
            fontFamily: "inherit",
            fontSize: "14px",
            boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)",
          },
        });
      }
    } catch (error: any) {
      toast.error(t("skills.folder.openFailed", { error: error.message }), {
        duration: 4000,
        style: {
          background: "rgba(239, 68, 68, 0.1)",
          border: "2px solid rgb(239, 68, 68)",
          backdropFilter: "blur(8px)",
          color: "rgb(252, 165, 165)",
          fontFamily: "inherit",
          fontSize: "14px",
          boxShadow: "0 0 30px rgba(239, 68, 68, 0.3)",
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-terminal-cyan" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" style={{ animation: "slideInLeft 0.5s ease-out" }}>
      {/* 页面标题 */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-terminal-cyan rounded-full animate-pulse" />
            <h1
              className="text-2xl font-bold text-terminal-cyan tracking-wider uppercase"
            >
              {t("overview.title")}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-mono pl-7">
            <span className="text-terminal-green">&gt;</span>{" "}
            {t("overview.subtitle", { count: statistics.installedCount })}
          </p>
        </div>

        {/* 一键扫描按钮 - 赛博朋克风格 */}
        <button
          onClick={() => scanMutation.mutate()}
          disabled={isScanning}
          className="
            relative
            px-4 py-2.5
            bg-terminal-cyan/10 text-terminal-cyan
            font-mono font-medium text-sm uppercase tracking-wider
            rounded border border-terminal-cyan/30
            hover:bg-terminal-cyan hover:text-background
            hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-300
            flex items-center gap-2
            overflow-hidden
            group
          "
        >
          {/* 按钮扫描线效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

          {/* 左侧发光条 */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-terminal-cyan animate-pulse" />

          {isScanning && <Loader2 className="w-4 h-4 animate-spin relative z-10" />}
          <span className="relative z-10">
            {isScanning ? t("overview.scanStatus.scanning") : t("overview.scanStatus.scanAll")}
          </span>
        </button>
      </div>

      {/* 主体区域：减少纵向堆叠，更多内容可在默认尺寸下同屏展示 */}
      <div className="grid gap-5 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-12">
          <StatisticsCards
            installedCount={statistics.installedCount}
            repositoryCount={statistics.repositoryCount}
            scannedCount={statistics.scannedCount}
          />
        </div>

        <div className="lg:col-span-7 h-full">
          <ScanStatusCard
            lastScanTime={lastScanTime}
            scannedCount={statistics.scannedCount}
            totalCount={statistics.installedCount}
            issueCount={issueCount}
            isScanning={isScanning}
          />
        </div>

        <div className="lg:col-span-5 h-full">
          <IssuesSummaryCard
            issuesByLevel={issuesByLevel}
            filterLevel={filterLevel}
            onFilterChange={setFilterLevel}
          />
        </div>

        <div className="lg:col-span-12">
          <div className="cyber-card border-border/60 bg-card/40 backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-red animate-pulse" />
                {t("overview.section.issueDetails")}
              </div>
              {filterLevel && (
                <button
                  onClick={() => setFilterLevel(null)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs bg-muted/30 hover:bg-muted/50 border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
                  title={t("overview.issues.clearFilters")}
                >
                  <X className="w-3.5 h-3.5" />
                  {t("overview.issues.clearFilters")}
                </button>
              )}
            </div>

            <div className="p-4">
              <div className="max-h-[min(56vh,560px)] overflow-y-auto pr-1">
                {filteredIssues.length === 0 ? (
                  <div className="text-center py-7 bg-card/30 border border-border/40 rounded-lg">
                    <div className="flex flex-col items-center gap-2.5">
                      {filterLevel === "Safe" ? (
                        <div className="w-11 h-11 rounded-full bg-terminal-green/10 border border-terminal-green/30 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-terminal-green" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-terminal-green/10 border border-terminal-green/30 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-terminal-green" />
                        </div>
                      )}
                      <div className="text-base font-medium text-foreground">
                        {filterLevel === "Critical"
                          ? t("overview.issues.noCriticalIssues")
                          : filterLevel === "Medium"
                            ? t("overview.issues.noMediumIssues")
                            : filterLevel === "Safe"
                              ? t("overview.issues.noSafeSkills")
                              : t("overview.issues.noIssues")}
                      </div>
                      {!filterLevel && lastScanTime && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {t("overview.issues.lastScanned", {
                            time: lastScanTime.toLocaleString(),
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <IssuesList issues={filteredIssues} onOpenDirectory={handleOpenDirectory} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
