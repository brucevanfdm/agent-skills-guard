import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Search } from "lucide-react";

// TypeScript 接口定义
interface SecurityIssue {
  severity: string;
  category: string;
  description: string;
  line_number?: number;
  code_snippet?: string;
}

interface SecurityReport {
  skill_id: string;
  score: number;
  level: string;
  issues: SecurityIssue[];
  recommendations: string[];
  blocked: boolean;
  hard_trigger_issues: string[];
}

interface SkillScanResult {
  skill_id: string;
  skill_name: string;
  score: number;
  level: string;
  scanned_at: string;
  report: SecurityReport;
}

export function SecurityDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "name" | "time">("score");
  const [searchQuery, setSearchQuery] = useState("");

  // 获取扫描结果
  const { data: scanResults = [], isLoading } = useQuery<SkillScanResult[]>({
    queryKey: ["scanResults"],
    queryFn: async () => {
      return await invoke("get_scan_results");
    },
  });

  // 执行扫描
  const handleScan = async () => {
    setIsScanning(true);
    try {
      const results = await invoke<SkillScanResult[]>("scan_all_installed_skills");
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      toast.success(t("security.dashboard.scanSuccess", { count: results.length }));
    } catch (error) {
      console.error("Scan failed:", error);
      toast.error(t("security.dashboard.scanError"));
    } finally {
      setIsScanning(false);
    }
  };

  // 过滤和排序
  const filteredAndSortedResults = useMemo(() => {
    return scanResults
      .filter((result) => {
        // 等级过滤
        if (filterLevel !== "all" && result.level !== filterLevel) {
          return false;
        }
        // 搜索过滤
        if (searchQuery && !result.skill_name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "score":
            return a.score - b.score; // 低分在前
          case "name":
            return a.skill_name.localeCompare(b.skill_name);
          case "time":
            return new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime();
          default:
            return 0;
        }
      });
  }, [scanResults, filterLevel, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("security.dashboard.title")}</h1>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isScanning ? t("security.dashboard.scanning") : t("security.dashboard.scanButton")}
        </button>
      </div>

      {/* 过滤和排序栏 */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card/30 rounded-lg border border-border">
        {/* 风险等级过滤 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-mono text-muted-foreground">
            {t('security.filterByLevel')}:
          </label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-1 bg-background border border-border rounded font-mono text-sm"
          >
            <option value="all">{t('security.levels.all')}</option>
            <option value="Critical">{t('security.levels.critical')}</option>
            <option value="High">{t('security.levels.high')}</option>
            <option value="Medium">{t('security.levels.medium')}</option>
            <option value="Low">{t('security.levels.low')}</option>
            <option value="Safe">{t('security.levels.safe')}</option>
          </select>
        </div>

        {/* 排序选项 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-mono text-muted-foreground">
            {t('security.sortBy')}:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "score" | "name" | "time")}
            className="px-3 py-1 bg-background border border-border rounded font-mono text-sm"
          >
            <option value="score">{t('security.sort.score')}</option>
            <option value="name">{t('security.sort.name')}</option>
            <option value="time">{t('security.sort.time')}</option>
          </select>
        </div>

        {/* 搜索框 */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('security.search')}
              className="w-full pl-10 pr-4 py-1 bg-background border border-border rounded font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* TODO: 任务 4.3 - Skills 列表表格 */}

      {/* 临时占位符 */}
      {isLoading ? (
        <div className="text-center py-8">{t("security.dashboard.loading")}</div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {filteredAndSortedResults.length === 0
            ? t("security.dashboard.noResults")
            : `${t("security.dashboard.resultsCount")}: ${filteredAndSortedResults.length}`}
        </div>
      )}
    </div>
  );
}
