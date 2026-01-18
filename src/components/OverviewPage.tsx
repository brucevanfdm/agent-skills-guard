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
import { appToast } from "@/lib/toast";
import { GroupCard, GroupCardItem } from "./ui/GroupCard";

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);

  const { data: installedSkills = [] } = useQuery<Skill[]>({
    queryKey: ["skills", "installed"],
    queryFn: api.getInstalledSkills,
  });

  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["repositories"],
    queryFn: api.getRepositories,
  });

  const { data: scanResults = [], isLoading } = useQuery<SkillScanResult[]>({
    queryKey: ["scanResults"],
    queryFn: async () => {
      return await invoke("get_scan_results");
    },
  });

  const uniqueInstalledSkills = useMemo(() => {
    const byId = new Map<string, Skill>();
    installedSkills.forEach((skill) => {
      byId.set(skill.id, skill);
    });
    return Array.from(byId.values());
  }, [installedSkills]);

  const uniqueScanResults = useMemo(() => {
    const byId = new Map<string, SkillScanResult>();
    scanResults.forEach((result) => {
      byId.set(result.skill_id, result);
    });
    return Array.from(byId.values());
  }, [scanResults]);

  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      let localSkillsCount = 0;

      try {
        const localSkills = await api.scanLocalSkills();
        localSkillsCount = localSkills.length;
        await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
        await queryClient.refetchQueries({ queryKey: ["skills"] });
      } catch (error: any) {
        console.error("扫描本地技能失败:", error);
        appToast.error(t("overview.scan.localSkillsFailed", { error: error.message }), {
          duration: 4000,
        });
      }

      const results = await invoke<SkillScanResult[]>("scan_all_installed_skills", {
        locale: i18n.language,
      });

      return { results, localSkillsCount };
    },
    onSuccess: ({ results, localSkillsCount }) => {
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      appToast.success(
        t("overview.scan.allCompleted", {
          localCount: localSkillsCount,
          scannedCount: results.length,
        }),
        { duration: 4000 }
      );
    },
    onError: (error: any) => {
      appToast.error(t("overview.scan.failed", { error: error.message }), { duration: 4000 });
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  const statistics = useMemo(
    () => ({
      installedCount: uniqueInstalledSkills.filter((s) => s.installed).length,
      repositoryCount: repositories.length,
      scannedCount: uniqueScanResults.length,
    }),
    [repositories.length, uniqueInstalledSkills, uniqueScanResults]
  );

  const issuesByLevel = useMemo(() => {
    const result: Record<string, number> = { Severe: 0, MidHigh: 0, Safe: 0 };
    uniqueScanResults.forEach((r) => {
      if (r.level === "Critical") result.Severe++;
      else if (r.level === "High" || r.level === "Medium") result.MidHigh++;
      else if (r.level === "Safe" || r.level === "Low") result.Safe++;
    });
    return result;
  }, [uniqueScanResults]);

  const lastScanTime = useMemo(() => {
    if (!uniqueScanResults.length) return null;
    return new Date(Math.max(...uniqueScanResults.map((r) => new Date(r.scanned_at).getTime())));
  }, [uniqueScanResults]);

  const issueCount = useMemo(() => {
    return uniqueScanResults.filter((r) => r.level !== "Safe" && r.level !== "Low").length;
  }, [uniqueScanResults]);

  const filteredIssues = useMemo(() => {
    return uniqueScanResults
      .filter((result) => {
        if (!filterLevel) return result.level !== "Safe" && result.level !== "Low";
        if (filterLevel === "Severe") return result.level === "Critical";
        if (filterLevel === "MidHigh") return result.level === "Medium" || result.level === "High";
        if (filterLevel === "Safe") return result.level === "Safe" || result.level === "Low";
        return false;
      })
      .sort((a, b) => {
        const levelOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Safe: 4 };
        return (
          (levelOrder[a.level as keyof typeof levelOrder] || 999) -
          (levelOrder[b.level as keyof typeof levelOrder] || 999)
        );
      });
  }, [uniqueScanResults, filterLevel]);

  const handleOpenDirectory = async (skillId: string) => {
    try {
      const skill = uniqueInstalledSkills.find((s) => s.id === skillId);
      if (skill?.local_path) {
        await invoke("open_skill_directory", { localPath: skill.local_path });
      } else {
        appToast.error("无法找到技能路径", { duration: 4000 });
      }
    } catch (error: any) {
      appToast.error(t("skills.folder.openFailed", { error: error.message }), { duration: 4000 });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 页面标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline text-foreground">{t("overview.title")}</h1>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={isScanning}
          className="apple-button-primary flex items-center gap-2"
        >
          {isScanning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {isScanning ? t("overview.scanStatus.scanning") : t("overview.scanStatus.scanAll")}
        </button>
      </div>

      {/* 统计卡片 */}
      <StatisticsCards
        installedCount={statistics.installedCount}
        repositoryCount={statistics.repositoryCount}
        scannedCount={statistics.scannedCount}
      />

      {/* 扫描状态 + 问题概览 */}
      <div className="grid gap-5 lg:grid-cols-12">
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
      </div>

      {/* 问题详情列表 */}
      <GroupCard>
        <GroupCardItem noBorder className="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-semibold text-foreground">
                {t("overview.section.issueDetails")}
              </span>
              <span className="text-sm text-muted-foreground font-medium truncate">
                {filteredIssues.length > 0
                  ? t("overview.issues.showing", { count: filteredIssues.length })
                  : t("overview.issues.noIssues")}
              </span>
            </div>
            {filterLevel && (
              <button
                onClick={() => setFilterLevel(null)}
                className="apple-button-secondary text-xs flex items-center gap-1.5 h-7 px-3"
              >
                <X className="w-3.5 h-3.5" />
                {t("overview.issues.clearFilters")}
              </button>
            )}
          </div>
          <div className="py-1">
            {filteredIssues.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    {filterLevel === "Safe" ? (
                      <Shield className="w-6 h-6 text-green-600" />
                    ) : (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {filterLevel === "Severe"
                      ? t("overview.issues.noSevereIssues")
                      : filterLevel === "MidHigh"
                        ? t("overview.issues.noMidHighIssues")
                        : filterLevel === "Safe"
                          ? t("overview.issues.noSafeSkills")
                          : t("overview.issues.noIssues")}
                  </div>
                </div>
              </div>
            ) : (
              <IssuesList issues={filteredIssues} onOpenDirectory={handleOpenDirectory} />
            )}
          </div>
        </GroupCardItem>
      </GroupCard>
    </div>
  );
}
