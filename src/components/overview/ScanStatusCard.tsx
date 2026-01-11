import { useTranslation } from "react-i18next";
import { CheckCircle, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

interface ScanStatusCardProps {
  lastScanTime: Date | null;
  scannedCount: number;
  totalCount: number;
  issueCount: number;
  isScanning: boolean;
}

export function ScanStatusCard({
  lastScanTime,
  scannedCount,
  totalCount,
  issueCount,
  isScanning,
}: ScanStatusCardProps) {
  const { t, i18n } = useTranslation();

  const progress = totalCount > 0 ? (scannedCount / totalCount) * 100 : 0;
  const isComplete = scannedCount === totalCount && totalCount > 0;

  // 格式化相对时间
  const formatRelativeTime = (date: Date) => {
    const locale = i18n.language === "zh" ? zhCN : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  // 根据状态确定颜色
  const getStatusColor = () => {
    if (isScanning) return "terminal-cyan";
    if (isComplete && issueCount === 0) return "terminal-green";
    if (isComplete && issueCount > 0) return "terminal-yellow";
    return "terminal-cyan";
  };

  const statusColor = getStatusColor() as keyof typeof statusStyles;
  const {
    glowColor,
    gradientFrom,
    borderColor,
    hoverBorderColor,
    barColor,
    textColor,
    hoverShadow,
  } = statusStyles[statusColor];

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg h-full
        bg-gradient-to-br ${gradientFrom} to-transparent bg-card
        border ${borderColor}
        ${hoverBorderColor} ${hoverShadow}
        transition-all duration-300
        group
      `}
      style={{
        backdropFilter: "blur(10px)",
      }}
    >
      {/* 赛博朋克网格背景 */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(${glowColor} 1px, transparent 1px),
            linear-gradient(90deg, ${glowColor} 1px, transparent 1px)
          `,
          backgroundSize: "20px 20px",
        }}
      />

      {/* 左侧动态发光竖线 */}
      <div
        className={`absolute top-0 left-0 w-1.5 h-full ${barColor} transition-all duration-300 group-hover:w-2`}
      >
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            boxShadow: `0 0 15px ${glowColor}, 0 0 30px ${glowColor}`,
          }}
        />
      </div>

      {/* 顶部扫描线动画 */}
      <div
        className={`absolute top-0 left-0 right-0 h-px ${barColor} opacity-30`}
        style={{
          animation: `scan-line 3s ease-in-out infinite`,
        }}
      />

      {/* 角落装饰 */}
      <div
        className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${borderColor} rounded-tl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
      />
      <div
        className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${borderColor} rounded-tr-lg opacity-50 group-hover:opacity-100 transition-opacity`}
      />
      <div
        className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${borderColor} rounded-bl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
      />
      <div
        className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${borderColor} rounded-br-lg opacity-50 group-hover:opacity-100 transition-opacity`}
      />

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center relative p-5 pl-4">
        {/* 左侧：扫描信息 */}
        <div className="flex-shrink-0 min-w-[200px] space-y-2.5">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${textColor}`} />
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {t("overview.scanStatus.lastScan")}
            </span>
          </div>
          {lastScanTime ? (
            <div
              className="text-foreground font-mono font-bold text-base pl-6"
              style={{ color: `hsl(var(--${statusColor}))` }}
            >
              {formatRelativeTime(lastScanTime)}
            </div>
          ) : (
            <div className="text-terminal-yellow font-mono font-bold text-base pl-6">
              {t("overview.scanStatus.never")}
            </div>
          )}

          <div className="flex items-center gap-3 pl-6 pt-1">
            <Activity className={`w-4 h-4 ${textColor} ${isScanning ? "animate-pulse" : ""}`} />
            <div className="text-xs text-muted-foreground font-mono">
              <span className="text-muted-foreground">{t("overview.scanStatus.scanned")}</span>
              <span
                className={`font-bold mx-1 ${textColor}`}
                style={{ color: `hsl(var(--${statusColor}))` }}
              >
                {scannedCount}
              </span>
              <span className="text-muted-foreground">{t("overview.scanStatus.of")}</span>
              <span
                className={`font-bold mx-1 ${textColor}`}
                style={{ color: `hsl(var(--${statusColor}))` }}
              >
                {totalCount}
              </span>
              <span className="text-muted-foreground">{t("overview.scanStatus.skills")}</span>
            </div>
          </div>
        </div>

        {/* 右侧：进度条 - 占据剩余全部空间 */}
        <div className="flex-1 w-full space-y-3">
          <div className="relative w-full h-3 bg-muted/30 rounded-full overflow-hidden border border-border/50 shadow-inner">
            {/* 背景扫描线动画 */}
            {isScanning && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-terminal-cyan/30 to-transparent animate-scan-line"></div>
            )}

            {/* 进度条 */}
            <div
              className={`
                h-full transition-all duration-500 rounded-full relative
                ${
                  isScanning
                    ? "bg-gradient-to-r from-terminal-cyan/80 via-terminal-cyan to-terminal-cyan/80"
                    : isComplete && issueCount === 0
                      ? "bg-gradient-to-r from-terminal-green/80 via-terminal-green to-terminal-green/80"
                      : isComplete && issueCount > 0
                        ? "bg-gradient-to-r from-terminal-yellow/80 via-terminal-yellow to-terminal-yellow/80"
                        : "bg-gradient-to-r from-terminal-cyan/80 via-terminal-cyan to-terminal-cyan/80"
                }
              `}
              style={{ width: `${progress}%` }}
            >
              {/* 进度条发光效果 */}
              {isScanning && (
                <div className="absolute inset-0 bg-terminal-cyan opacity-60 animate-pulse"></div>
              )}

              {/* 进度条内部扫描线 */}
              {isScanning && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-scan-line"></div>
              )}
            </div>

            {/* 进度百分比文字 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={`text-[11px] font-mono font-bold ${isScanning ? "text-terminal-cyan animate-pulse" : isComplete && issueCount === 0 ? "text-terminal-green" : isComplete && issueCount > 0 ? "text-terminal-yellow" : "text-terminal-cyan"}`}
              >
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* 进度文本 / 状态显示 */}
          {isComplete && !isScanning ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle
                className={`w-4 h-4 ${issueCount === 0 ? "text-terminal-green" : "text-terminal-yellow"}`}
              />
              <span className="text-muted-foreground font-mono">
                {issueCount === 0
                  ? t("overview.scanStatus.noIssues")
                  : t("overview.scanStatus.completed", { count: issueCount })}
              </span>
            </div>
          ) : isScanning ? (
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-terminal-cyan animate-pulse" />
              <span className="text-terminal-cyan font-mono animate-pulse">
                {t("overview.scanStatus.scanning")}...
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 底部数据流装饰线 */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden opacity-30">
        <div
          className={`h-full w-1/3 ${barColor}`}
          style={{
            animation: "dataFlow 2s ease-in-out infinite",
            marginLeft: "-33%",
          }}
        />
      </div>

      {/* 悬停时的边框发光效果 */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 20px ${glowColor}30, 0 0 20px ${glowColor}20`,
          border: `1px solid ${glowColor}40`,
        }}
      />
    </div>
  );
}

const statusStyles = {
  "terminal-cyan": {
    glowColor: "rgba(94, 234, 212, 0.4)",
    gradientFrom: "from-terminal-cyan/5",
    borderColor: "border-terminal-cyan/30",
    hoverBorderColor: "hover:border-terminal-cyan/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(94,234,212,0.2)]",
    barColor: "bg-terminal-cyan",
    textColor: "text-terminal-cyan",
  },
  "terminal-green": {
    glowColor: "rgba(74, 222, 128, 0.4)",
    gradientFrom: "from-terminal-green/5",
    borderColor: "border-terminal-green/30",
    hoverBorderColor: "hover:border-terminal-green/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(74,222,128,0.2)]",
    barColor: "bg-terminal-green",
    textColor: "text-terminal-green",
  },
  "terminal-yellow": {
    glowColor: "rgba(250, 204, 21, 0.4)",
    gradientFrom: "from-terminal-yellow/5",
    borderColor: "border-terminal-yellow/30",
    hoverBorderColor: "hover:border-terminal-yellow/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(250,204,21,0.2)]",
    barColor: "bg-terminal-yellow",
    textColor: "text-terminal-yellow",
  },
} as const;
