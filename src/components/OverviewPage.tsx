import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2, CheckCircle, Shield, X } from "lucide-react";
import type { SkillScanResult } from "@/types/security";
import type { Plugin, Skill, Repository } from "@/types";
import { api } from "@/lib/api";
import { StatisticsCards } from "./overview/StatisticsCards";
import { ScanStatusCard } from "./overview/ScanStatusCard";
import { IssuesSummaryCard } from "./overview/IssuesSummaryCard";
import { IssuesList } from "./overview/IssuesList";
import { appToast } from "@/lib/toast";
import { GroupCard, GroupCardItem } from "./ui/GroupCard";
import type { SecurityIssue, SecurityReport } from "@/types/security";
import { openPath } from "@tauri-apps/plugin-opener";
import { useClaudeMarketplaces, usePlugins } from "@/hooks/usePlugins";

export function OverviewPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const scanStatusQueryKey = ["overview", "scan-status"];
  const defaultScanStatus = {
    isScanning: false,
    itemProgress: { scanned: 0, total: 0 },
  };
  const { data: scanStatus = defaultScanStatus } = useQuery<{
    isScanning: boolean;
    itemProgress: { scanned: number; total: number };
  }>({
    queryKey: scanStatusQueryKey,
    queryFn: () => defaultScanStatus,
    initialData: defaultScanStatus,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const [filterLevel, setFilterLevel] = useState<string | null>(null);

  const isScanning = scanStatus.isScanning;
  const itemProgress = scanStatus.itemProgress;
  const setScanStatus = (
    updater: (prev: { isScanning: boolean; itemProgress: { scanned: number; total: number } }) => {
      isScanning: boolean;
      itemProgress: { scanned: number; total: number };
    }
  ) => {
    queryClient.setQueryData(
      scanStatusQueryKey,
      (prev?: { isScanning: boolean; itemProgress: { scanned: number; total: number } }) =>
        updater(prev ?? defaultScanStatus)
    );
  };

  const { data: installedSkills = [] } = useQuery<Skill[]>({
    queryKey: ["skills", "installed"],
    queryFn: api.getInstalledSkills,
  });

  const { data: repositories = [] } = useQuery<Repository[]>({
    queryKey: ["repositories"],
    queryFn: api.getRepositories,
  });

  const { data: plugins = [], isLoading: isPluginsLoading } = usePlugins();

  const { data: marketplaces = [], isLoading: isMarketplacesLoading } = useClaudeMarketplaces();

  const { data: scanResults = [], isLoading: isScanResultsLoading } = useQuery<SkillScanResult[]>({
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
      setScanStatus(() => ({
        isScanning: true,
        itemProgress: { scanned: 0, total: 0 },
      }));
      let localSkillsCount = 0;
      let installedPluginsCount = 0;
      let marketplaceCount = 0;
      let scannedPluginsCount = 0;
      let installedSkillsCount = 0;

      try {
        const localSkills = await api.scanLocalSkills();
        localSkillsCount = localSkills.length;
        const installedSkillsNow = await api.getInstalledSkills();
        installedSkillsCount = installedSkillsNow.length;
        await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
        await queryClient.refetchQueries({ queryKey: ["skills"] });
      } catch (error: any) {
        console.error("扫描本地技能失败:", error);
        appToast.error(t("overview.scan.localSkillsFailed", { error: error.message }), {
          duration: 4000,
        });
      }

      let installedPlugins: Plugin[] = [];
      try {
        const latestPlugins = await api.getPlugins(i18n.language);
        installedPlugins = latestPlugins.filter((p) => p.installed);
        installedPluginsCount = installedPlugins.length;
        await queryClient.refetchQueries({ queryKey: ["plugins"] });
      } catch (error: any) {
        console.error("扫描本地插件失败:", error);
      }

      let installedSkills: Skill[] = [];
      try {
        installedSkills = await api.getInstalledSkills();
      } catch {
        installedSkills = [];
      }

      const totalItems = installedSkillsCount + installedPluginsCount;
      setScanStatus((prev) => ({
        ...prev,
        itemProgress: { scanned: 0, total: totalItems },
      }));

      try {
        const latestMarketplaces = await api.getClaudeMarketplaces();
        marketplaceCount = latestMarketplaces.length;
        await queryClient.refetchQueries({ queryKey: ["claudeMarketplaces"] });
      } catch (error: any) {
        console.error("扫描 Marketplace 失败:", error);
      }

      try {
        for (const plugin of installedPlugins) {
          try {
            await api.scanInstalledPlugin(plugin.id, i18n.language);
            scannedPluginsCount += 1;
          } catch (e) {
            console.error("扫描插件失败:", plugin.name, e);
          } finally {
            setScanStatus((prev) => {
              const next =
                prev.itemProgress.total > 0
                  ? Math.min(prev.itemProgress.total, prev.itemProgress.scanned + 1)
                  : 0;
              return {
                ...prev,
                itemProgress: { ...prev.itemProgress, scanned: next },
              };
            });
          }
        }
        await queryClient.refetchQueries({ queryKey: ["plugins"] });
      } catch (error: any) {
        console.error("安全扫描插件失败:", error);
      }

      const results: SkillScanResult[] = [];
      try {
        for (const skill of installedSkills) {
          try {
            const result = await api.scanInstalledSkill(skill.id, i18n.language);
            results.push(result);
          } catch (e) {
            console.error("扫描技能失败:", skill.name, e);
          } finally {
            setScanStatus((prev) => {
              const next =
                prev.itemProgress.total > 0
                  ? Math.min(prev.itemProgress.total, prev.itemProgress.scanned + 1)
                  : 0;
              return {
                ...prev,
                itemProgress: { ...prev.itemProgress, scanned: next },
              };
            });
          }
        }
      } catch (error: any) {
        console.error("安全扫描技能失败:", error);
      }

      return {
        results,
        localSkillsCount,
        installedPluginsCount,
        marketplaceCount,
        scannedPluginsCount,
      };
    },
    onSuccess: ({ results, localSkillsCount, installedPluginsCount, marketplaceCount, scannedPluginsCount }) => {
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["claudeMarketplaces"] });
      appToast.success(
        t("overview.scan.allCompleted", {
          localCount: localSkillsCount,
          scannedCount: results.length,
          pluginCount: installedPluginsCount,
          marketplaceCount,
          scannedPluginsCount,
        }),
        { duration: 4000 }
      );
    },
    onError: (error: any) => {
      appToast.error(t("overview.scan.failed", { error: error.message }), { duration: 4000 });
    },
    onSettled: () => {
      setScanStatus((prev) => ({
        ...prev,
        isScanning: false,
      }));
    },
  });

  const statistics = useMemo(
    () => ({
      installedCount: uniqueInstalledSkills.filter((s) => s.installed).length,
      pluginCount: plugins.filter((p) => p.installed).length,
      marketplaceCount: marketplaces.length,
      repositoryCount: repositories.length,
    }),
    [marketplaces.length, plugins, repositories.length, uniqueInstalledSkills]
  );

  const scanActionLabel = t("overview.scanStatus.scanning");

  const scannedPluginsCount = useMemo(() => {
    return plugins.filter((p) => p.installed && p.security_score != null).length;
  }, [plugins]);

  const totalItemsCount = useMemo(() => {
    return statistics.installedCount + statistics.pluginCount;
  }, [statistics.installedCount, statistics.pluginCount]);

  const scannedItemsCount = useMemo(() => {
    return uniqueScanResults.length + scannedPluginsCount;
  }, [scannedPluginsCount, uniqueScanResults.length]);

  const displayScannedCount = isScanning ? itemProgress.scanned : scannedItemsCount;
  const displayTotalCount = isScanning ? itemProgress.total : totalItemsCount;
  const issuesByLevel = useMemo(() => {
    const result: Record<string, number> = { Severe: 0, MidHigh: 0, Safe: 0 };
    uniqueScanResults.forEach((r) => {
      if (r.level === "Critical") result.Severe++;
      else if (r.level === "High" || r.level === "Medium") result.MidHigh++;
      else if (r.level === "Safe" || r.level === "Low") result.Safe++;
    });
    plugins.forEach((p) => {
      if (!p.installed || p.security_level == null) return;
      if (p.security_level === "Critical") result.Severe++;
      else if (p.security_level === "High" || p.security_level === "Medium") result.MidHigh++;
      else if (p.security_level === "Safe" || p.security_level === "Low") result.Safe++;
    });
    return result;
  }, [plugins, uniqueScanResults]);

  const lastScanTime = useMemo(() => {
    const times: number[] = [];
    uniqueScanResults.forEach((r) => times.push(new Date(r.scanned_at).getTime()));
    plugins.forEach((p) => {
      if (p.installed && p.scanned_at) times.push(new Date(p.scanned_at).getTime());
    });
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }, [plugins, uniqueScanResults]);

  const issueCount = useMemo(() => {
    const skillIssues = uniqueScanResults.filter((r) => r.level !== "Safe" && r.level !== "Low").length;
    const pluginIssues = plugins.filter((p) => {
      if (!p.installed) return false;
      const level = p.security_level;
      if (!level) return false;
      return level !== "Safe" && level !== "Low";
    }).length;
    return skillIssues + pluginIssues;
  }, [plugins, uniqueScanResults]);

  const combinedIssues = useMemo(() => {
    const bySkillId = new Map<string, Skill>();
    uniqueInstalledSkills.forEach((s) => bySkillId.set(s.id, s));

    const items: Array<SkillScanResult & { kind: "skill" | "plugin"; local_path?: string }> = [];

    uniqueScanResults.forEach((r) => {
      items.push({
        ...r,
        kind: "skill",
        local_path: bySkillId.get(r.skill_id)?.local_path,
      });
    });

    plugins.forEach((p) => {
      if (!p.installed || p.security_score == null || p.security_level == null) return;
      items.push({
        kind: "plugin",
        local_path: p.claude_install_path,
        skill_id: p.id,
        skill_name: p.name,
        score: p.security_score,
        level: p.security_level,
        scanned_at: p.scanned_at || new Date().toISOString(),
        report: buildReportFromPlugin(p),
      });
    });

    return items;
  }, [plugins, uniqueInstalledSkills, uniqueScanResults]);

  const filteredIssues = useMemo(() => {
    return combinedIssues
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
  }, [combinedIssues, filterLevel]);

  const handleOpenDirectory = async (
    item: SkillScanResult & { kind: "skill" | "plugin"; local_path?: string }
  ) => {
    try {
      if (item.kind === "skill") {
        const skill = uniqueInstalledSkills.find((s) => s.id === item.skill_id);
        if (skill?.local_path) {
          await invoke("open_skill_directory", { localPath: skill.local_path });
        } else {
          appToast.error("无法找到技能路径", { duration: 4000 });
        }
      } else {
        const path = item.local_path;
        if (path) {
          try {
            await invoke("open_skill_directory", { localPath: path });
          } catch {
            await openPath(path);
          }
        } else {
          appToast.error("无法找到插件路径", { duration: 4000 });
        }
      }
    } catch (error: any) {
      appToast.error(t("skills.folder.openFailed", { error: error.message }), { duration: 4000 });
    }
  };

  if (isScanResultsLoading || isPluginsLoading || isMarketplacesLoading) {
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
          {isScanning ? scanActionLabel : t("overview.scanStatus.scanAll")}
        </button>
      </div>

      {/* 统计卡片 */}
      <StatisticsCards
        installedCount={statistics.installedCount}
        pluginCount={statistics.pluginCount}
        marketplaceCount={statistics.marketplaceCount}
        repositoryCount={statistics.repositoryCount}
      />

      {/* 扫描状态 + 问题概览 */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 h-full">
          <ScanStatusCard
            lastScanTime={lastScanTime}
            scannedCount={displayScannedCount}
            totalCount={displayTotalCount}
            issueCount={issueCount}
            isScanning={isScanning}
            scanLabel={scanActionLabel}
            countLabel={t("overview.scanStatus.items")}
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

function buildReportFromPlugin(plugin: Plugin): SecurityReport {
  const issues: SecurityIssue[] = (plugin.security_issues || [])
    .map(parseStoredIssueString)
    .filter((v): v is SecurityIssue => v !== null);

  return {
    skill_id: plugin.id,
    score: plugin.security_score ?? 0,
    level: plugin.security_level ?? "Unknown",
    issues,
    recommendations: [],
    blocked: false,
    hard_trigger_issues: [],
    scanned_files: [],
    partial_scan: false,
    skipped_files: [],
  };
}

function parseStoredIssueString(issue: string): SecurityIssue | null {
  const raw = issue.trim();
  if (!raw) return null;

  // Format (Rust): "[path] Severity: description" or "Severity: description"
  let file_path: string | undefined;
  let remaining = raw;
  if (remaining.startsWith("[")) {
    const end = remaining.indexOf("]");
    if (end > 1) {
      file_path = remaining.slice(1, end).trim() || undefined;
      remaining = remaining.slice(end + 1).trim();
    }
  }

  const parts = remaining.split(":");
  if (parts.length < 2) {
    return {
      severity: "Info",
      category: "Other",
      description: remaining,
      file_path,
    };
  }

  const severity = parts[0].trim();
  const description = parts.slice(1).join(":").trim();
  const normalized =
    severity === "Critical" || severity === "Error" || severity === "Warning" || severity === "Info"
      ? severity
      : "Info";

  return {
    severity: normalized,
    category: "Other",
    description: description || remaining,
    file_path,
  };
}
