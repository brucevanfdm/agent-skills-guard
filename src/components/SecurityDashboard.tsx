import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Search, Loader2, Shield } from "lucide-react";
import { SecurityDetailDialog } from "./SecurityDetailDialog";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import type { SkillScanResult } from "@/types/security";
import { countIssuesBySeverity } from "@/lib/security-utils";

export function SecurityDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "name" | "time">("score");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillScanResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 风险等级选项
  const levelOptions: CyberSelectOption[] = [
    { value: "all", label: t('security.levels.all') },
    { value: "Critical", label: t('security.levels.critical') },
    { value: "High", label: t('security.levels.high') },
    { value: "Medium", label: t('security.levels.medium') },
    { value: "Low", label: t('security.levels.low') },
    { value: "Safe", label: t('security.levels.safe') },
  ];

  // 排序选项
  const sortOptions: CyberSelectOption[] = [
    { value: "score", label: t('security.sort.score') },
    { value: "name", label: t('security.sort.name') },
    { value: "time", label: t('security.sort.time') },
  ];

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
      showToast(t("security.dashboard.scanSuccess", { count: results.length }));
    } catch (error) {
      console.error("Scan failed:", error);
      showToast(t("security.dashboard.scanError"));
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
        <h1 className="text-2xl font-bold text-terminal-cyan tracking-wider uppercase">{t("security.dashboard.title")}</h1>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="neon-button inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("security.dashboard.scanning")}
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              {t("security.dashboard.scanButton")}
            </>
          )}
        </button>
      </div>

      {/* 过滤和排序栏 */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card/30 rounded-lg border border-border">
        {/* 风险等级过滤 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-mono text-terminal-green uppercase tracking-wider whitespace-nowrap">
            {t('security.filterByLevel')}:
          </label>
          <CyberSelect
            value={filterLevel}
            onChange={setFilterLevel}
            options={levelOptions}
            className="w-[240px]"
          />
        </div>

        {/* 排序选项 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-mono text-terminal-green uppercase tracking-wider whitespace-nowrap">
            {t('security.sortBy')}:
          </label>
          <CyberSelect
            value={sortBy}
            onChange={(value) => setSortBy(value as "score" | "name" | "time")}
            options={sortOptions}
            className="w-[200px]"
          />
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

      {/* Skills 列表表格 */}
      <div className="bg-card/30 rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-terminal-cyan" />
          </div>
        ) : filteredAndSortedResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mb-4" />
            <p className="font-mono">{t('security.noResults')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-background/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.skillName')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.score')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.level')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.issues')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.lastScan')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
                  {t('security.table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedResults.map((result) => {
                const issueCounts = countIssuesBySeverity(result.report.issues);

                return (
                  <tr key={result.skill_id} className="hover:bg-background/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm">
                      {result.skill_name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ScoreDisplay score={result.score} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <SecurityBadge level={result.level} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs font-mono">
                        {issueCounts.critical > 0 && (
                          <span className="text-red-500">C:{issueCounts.critical}</span>
                        )}
                        {issueCounts.error > 0 && (
                          <span className="text-orange-500">H:{issueCounts.error}</span>
                        )}
                        {issueCounts.warning > 0 && (
                          <span className="text-yellow-500">M:{issueCounts.warning}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-mono text-muted-foreground">
                      {new Date(result.scanned_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedSkill(result)}
                        className="px-3 py-1 text-xs font-mono border border-terminal-cyan text-terminal-cyan rounded hover:bg-terminal-cyan/10"
                      >
                        {t('security.table.viewDetails')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 详情对话框 */}
      <SecurityDetailDialog
        result={selectedSkill}
        open={selectedSkill !== null}
        onClose={() => setSelectedSkill(null)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-0 left-0 right-0 px-8 py-5 bg-terminal-cyan/15 border-t-2 border-terminal-cyan backdrop-blur-md shadow-2xl z-50 font-mono text-base text-terminal-cyan"
          style={{
            animation: 'slideInLeft 0.3s ease-out',
            boxShadow: '0 -4px 40px rgba(94, 234, 212, 0.4), inset 0 1px 0 rgba(94, 234, 212, 0.2)'
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center">
            <span className="text-terminal-green mr-3 text-lg">❯</span>
            <span className="tracking-wide">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SecurityBadge({ level }: { level: string }) {
  const colors = {
    Safe: "bg-green-500/20 text-green-500 border-green-500/50",
    Low: "bg-blue-500/20 text-blue-500 border-blue-500/50",
    Medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
    High: "bg-orange-500/20 text-orange-500 border-orange-500/50",
    Critical: "bg-red-500/20 text-red-500 border-red-500/50",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-mono border ${colors[level as keyof typeof colors] || colors.Safe}`}>
      {level}
    </span>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <span className={`text-2xl font-bold font-mono ${getColor(score)}`}>
      {score}
    </span>
  );
}
