import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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

      {/* TODO: 任务 4.2 - 过滤和排序栏 */}
      {/* TODO: 任务 4.3 - Skills 列表表格 */}

      {/* 临时占位符 */}
      {isLoading ? (
        <div className="text-center py-8">{t("security.dashboard.loading")}</div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {scanResults.length === 0
            ? t("security.dashboard.noResults")
            : `${t("security.dashboard.resultsCount")}: ${scanResults.length}`}
        </div>
      )}
    </div>
  );
}
