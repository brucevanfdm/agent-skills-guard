import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Shield, AlertTriangle, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SkillScanResult, SecurityIssue } from "@/types/security";

interface SecurityDetailDialogProps {
  result: SkillScanResult | null;
  open: boolean;
  onClose: () => void;
}

export function SecurityDetailDialog({ result, open, onClose }: SecurityDetailDialogProps) {
  const { t } = useTranslation();

  // 使用 useMemo 优化问题分组（必须在条件返回之前调用所有 hooks）
  const { criticalIssues, highIssues, mediumIssues, lowIssues } = useMemo(
    () => {
      if (!result) {
        return {
          criticalIssues: [],
          highIssues: [],
          mediumIssues: [],
          lowIssues: [],
        };
      }

      const { report } = result;
      return {
        criticalIssues: report.issues.filter((i) => i.severity === "Critical"),
        highIssues: report.issues.filter((i) => i.severity === "Error"),
        mediumIssues: report.issues.filter((i) => i.severity === "Warning"),
        lowIssues: report.issues.filter((i) => i.severity === "Info"),
      };
    },
    [result]
  );

  // 在所有 hooks 调用之后再做条件返回
  if (!result) return null;

  const { report } = result;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-terminal-cyan" />
            <div>
              <div className="text-xl">{result.skill_name}</div>
              <div className="text-sm text-muted-foreground font-normal mt-1">
                {t("security.detail.scanTime")}：{new Date(result.scanned_at).toLocaleString()}
              </div>
            </div>
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* 总体评分 */}
        <div className="flex items-center justify-between p-6 bg-card/50 rounded-lg border border-border">
          <div>
            <div className="text-sm text-muted-foreground mb-1">{t("security.detail.securityScore")}</div>
            <div className={`text-5xl font-bold font-mono ${
              result.score >= 90 ? 'text-green-500' :
              result.score >= 70 ? 'text-yellow-500' :
              result.score >= 50 ? 'text-orange-500' : 'text-red-500'
            }`}>
              {result.score}
            </div>
          </div>
          <div>
            <span className={`px-4 py-2 rounded-lg text-lg font-mono border ${
              result.level === 'Safe' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
              result.level === 'Low' ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' :
              result.level === 'Medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' :
              result.level === 'High' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' :
              'bg-red-500/20 text-red-500 border-red-500/50'
            }`}>
              {result.level}
            </span>
          </div>
        </div>

        {/* 问题列表 */}
        <div className="space-y-4">
          {criticalIssues.length > 0 && (
            <IssueSection
              title={t("security.detail.issues.critical")}
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              issues={criticalIssues}
              color="red"
            />
          )}

          {highIssues.length > 0 && (
            <IssueSection
              title={t("security.detail.issues.high")}
              icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
              issues={highIssues}
              color="orange"
              defaultCollapsed
            />
          )}

          {mediumIssues.length > 0 && (
            <IssueSection
              title={t("security.detail.issues.medium")}
              icon={<Info className="w-5 h-5 text-yellow-500" />}
              issues={mediumIssues}
              color="yellow"
              defaultCollapsed
            />
          )}

          {lowIssues.length > 0 && (
            <IssueSection
              title={t("security.detail.issues.low")}
              icon={<Info className="w-5 h-5 text-blue-500" />}
              issues={lowIssues}
              color="blue"
              defaultCollapsed
            />
          )}
        </div>

        {/* 建议区域 */}
        {report.recommendations.length > 0 && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <div className="font-mono text-sm font-bold mb-2">{t("security.detail.recommendations")}：</div>
            <ul className="space-y-1 text-sm">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-yellow-500">▸</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("security.detail.close")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 问题区块组件
function IssueSection({
  title,
  icon,
  issues,
  color,
  defaultCollapsed = false
}: {
  title: string;
  icon: React.ReactNode;
  issues: SecurityIssue[];
  color: "red" | "orange" | "yellow" | "blue";
  defaultCollapsed?: boolean;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // 使用颜色映射对象，而不是动态字符串拼接
  const colorClasses = {
    red: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      hoverBg: "hover:bg-red-500/20",
    },
    orange: {
      border: "border-orange-500/50",
      bg: "bg-orange-500/10",
      hoverBg: "hover:bg-orange-500/20",
    },
    yellow: {
      border: "border-yellow-500/50",
      bg: "bg-yellow-500/10",
      hoverBg: "hover:bg-yellow-500/20",
    },
    blue: {
      border: "border-blue-500/50",
      bg: "bg-blue-500/10",
      hoverBg: "hover:bg-blue-500/20",
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={`border rounded-lg overflow-hidden ${classes.border}`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between p-4 ${classes.bg} ${classes.hoverBg} transition-colors`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono font-bold">{title}</span>
          <span className="text-sm text-muted-foreground">({issues.length})</span>
        </div>
        <span className="text-sm">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {issues.map((issue, idx) => (
            <div key={idx} className="p-3 bg-background/50 rounded border border-border">
              <div className="font-mono text-sm font-bold mb-2">{issue.description}</div>
              {issue.code_snippet && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    {t("security.detail.lineNumber")}：{issue.line_number}
                  </div>
                  <pre className="p-2 bg-background rounded text-xs font-mono overflow-x-auto">
                    <code>{issue.code_snippet}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
