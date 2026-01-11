import { useTranslation } from "react-i18next";
import { AlertTriangle, AlertCircle, Shield } from "lucide-react";

interface IssuesSummaryCardProps {
  issuesByLevel: Record<string, number>;
  filterLevel: string | null;
  onFilterChange: (level: string | null) => void;
}

const levelConfig = {
  Critical: {
    icon: AlertTriangle,
    textClass: "text-terminal-red",
    accentBar: "bg-terminal-red",
    bgGlow: "from-terminal-red/5 to-transparent",
    borderColor: "border-terminal-red/30",
    hoverBorder: "hover:border-terminal-red/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]",
    glowColor: "rgba(239, 68, 68, 0.4)",
  },
  Medium: {
    icon: AlertCircle,
    textClass: "text-terminal-yellow",
    accentBar: "bg-terminal-yellow",
    bgGlow: "from-terminal-yellow/5 to-transparent",
    borderColor: "border-terminal-yellow/30",
    hoverBorder: "hover:border-terminal-yellow/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(250,204,21,0.3)]",
    glowColor: "rgba(250, 204, 21, 0.4)",
  },
  Safe: {
    icon: Shield,
    textClass: "text-terminal-green",
    accentBar: "bg-terminal-green",
    bgGlow: "from-terminal-green/5 to-transparent",
    borderColor: "border-terminal-green/30",
    hoverBorder: "hover:border-terminal-green/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(74,222,128,0.3)]",
    glowColor: "rgba(74, 222, 128, 0.4)",
  },
};

export function IssuesSummaryCard({
  issuesByLevel,
  filterLevel,
  onFilterChange,
}: IssuesSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3 lg:grid-rows-1">
      {Object.entries(levelConfig).map(([level, config], index) => {
        const Icon = config.icon;
        const count = issuesByLevel[level] || 0;
        const isSelected = filterLevel === level;

        return (
          <div
            key={level}
            onClick={() => onFilterChange(isSelected ? null : level)}
            className={`
              relative overflow-hidden rounded-lg h-full
              bg-gradient-to-br ${config.bgGlow} bg-card
              border ${isSelected ? config.hoverBorder.replace("hover:", "") : config.borderColor}
              ${config.hoverBorder} ${config.hoverShadow}
              transition-all duration-300
              group cursor-pointer
            `}
            style={{
              animation: `fadeIn 0.5s ease-out ${index * 0.08}s`,
              animationFillMode: "backwards",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* 赛博朋克网格背景 */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(${config.glowColor} 1px, transparent 1px),
                  linear-gradient(90deg, ${config.glowColor} 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            {/* 左侧动态发光竖线 */}
            <div
              className={`absolute top-0 left-0 ${isSelected ? "w-2.5" : "w-1.5"} h-full ${config.accentBar} transition-all duration-300 group-hover:w-2`}
              style={{
                boxShadow: isSelected
                  ? `0 0 20px ${config.glowColor}, 0 0 40px ${config.glowColor}`
                  : "none",
              }}
            >
              <div
                className={`absolute inset-0 ${isSelected ? "animate-pulse" : ""}`}
                style={{
                  boxShadow: `0 0 15px ${config.glowColor}`,
                }}
              />
            </div>

            {/* 顶部扫描线动画 */}
            <div
              className={`absolute top-0 left-0 right-0 h-px ${config.accentBar} opacity-30`}
              style={{
                animation: `scan-line 3s ease-in-out infinite`,
                animationDelay: `${index * 0.5}s`,
              }}
            />

            {/* 角落装饰 - 四个角落 */}
            <div
              className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${config.borderColor} rounded-tl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${config.borderColor} rounded-tr-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${config.borderColor} rounded-bl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${config.borderColor} rounded-br-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />

            {/* 背景六边形装饰 */}
            <div className={`absolute -bottom-8 -right-8 w-32 h-32 ${config.textClass} opacity-5`}>
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" />
              </svg>
            </div>

            {/* 内容区 */}
            <div className="relative p-3 pl-3">
              {/* 图标和选择指示器 */}
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`
                    p-1.5 rounded-md transition-all duration-300
                    ${
                      isSelected
                        ? `bg-opacity-20 ${config.bgGlow} ${config.hoverBorder.replace("hover:", "")}`
                        : "bg-muted/20"
                    }
                  `}
                  style={{
                    boxShadow: isSelected ? `0 0 20px ${config.glowColor}40` : "none",
                  }}
                >
                  <Icon
                    className={`w-5 h-5 ${config.textClass} ${isSelected ? "animate-pulse" : ""}`}
                    style={{
                      filter: isSelected ? `drop-shadow(0 0 8px ${config.glowColor})` : "none",
                    }}
                  />
                </div>
                {/* 选择状态指示器 */}
                {isSelected && (
                  <div
                    className={`w-3 h-3 rounded-full ${config.accentBar} animate-pulse`}
                    style={{
                      boxShadow: `0 0 10px ${config.glowColor}, 0 0 20px ${config.glowColor}`,
                    }}
                  />
                )}
              </div>

              {/* 数字显示 - 带发光效果 */}
              <div
                className={`text-3xl font-bold font-mono ${config.textClass} mb-1 group-hover:scale-105 transition-transform duration-300`}
                style={{
                  textShadow: `0 0 20px ${config.glowColor}`,
                }}
              >
                {count}
              </div>

              {/* 标签 */}
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${config.accentBar} ${count > 0 ? "animate-pulse" : "opacity-30"}`}
                />
                {t(`overview.riskLevels.${level.toLowerCase()}`)}
              </div>

              {/* 问题预览条 */}
              {count > 0 && (
                <div className="mt-2 flex gap-1">
                  {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-0.5 flex-1 ${config.accentBar} opacity-60 rounded-full`}
                      style={{
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 底部数据流装饰线 */}
            <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden opacity-30">
              <div
                className={`h-full w-1/3 ${config.accentBar}`}
                style={{
                  animation: "dataFlow 2s ease-in-out infinite",
                  marginLeft: "-33%",
                }}
              />
            </div>

            {/* 悬停时的边框发光效果 */}
            {isSelected && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  boxShadow: `inset 0 0 20px ${config.glowColor}30, 0 0 20px ${config.glowColor}20`,
                  border: `1px solid ${config.glowColor}40`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
