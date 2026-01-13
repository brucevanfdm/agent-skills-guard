import { useTranslation } from "react-i18next";
import { Package, FolderGit, Shield, Cpu } from "lucide-react";

interface StatisticsCardsProps {
  installedCount: number;
  repositoryCount: number;
  scannedCount: number;
}

const cards = [
  {
    key: "installedSkills",
    color: "terminal-cyan",
    icon: Package,
    bgGlow: "from-terminal-cyan/5 to-transparent",
    borderColor: "border-terminal-cyan/30",
    hoverBorder: "hover:border-terminal-cyan/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(94,234,212,0.3)]",
    accentBar: "bg-terminal-cyan",
    textClass: "text-terminal-cyan",
    glowColor: "rgba(94, 234, 212, 0.4)",
  },
  {
    key: "repositories",
    color: "terminal-green",
    icon: FolderGit,
    bgGlow: "from-terminal-green/5 to-transparent",
    borderColor: "border-terminal-green/30",
    hoverBorder: "hover:border-terminal-green/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(74,222,128,0.3)]",
    accentBar: "bg-terminal-green",
    textClass: "text-terminal-green",
    glowColor: "rgba(74, 222, 128, 0.4)",
  },
  {
    key: "scannedSkills",
    color: "terminal-purple",
    icon: Shield,
    bgGlow: "from-terminal-purple/5 to-transparent",
    borderColor: "border-terminal-purple/30",
    hoverBorder: "hover:border-terminal-purple/60",
    hoverShadow: "hover:shadow-[0_0_30px_rgba(192,132,252,0.3)]",
    accentBar: "bg-terminal-purple",
    textClass: "text-terminal-purple",
    glowColor: "rgba(192, 132, 252, 0.4)",
  },
];

export function StatisticsCards({
  installedCount,
  repositoryCount,
  scannedCount,
}: StatisticsCardsProps) {
  const { t } = useTranslation();
  const counts = [installedCount, repositoryCount, scannedCount];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const count = counts[index];

        return (
          <div
            key={card.key}
            className={`
              relative overflow-hidden rounded-lg h-[150px]
              bg-gradient-to-br ${card.bgGlow} bg-card
              border ${card.borderColor}
              ${card.hoverBorder} ${card.hoverShadow}
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
                  linear-gradient(${card.glowColor} 1px, transparent 1px),
                  linear-gradient(90deg, ${card.glowColor} 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            {/* 角落装饰 - 四个角落 */}
            <div
              className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${card.borderColor} rounded-tl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 ${card.borderColor} rounded-tr-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 ${card.borderColor} rounded-bl-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />
            <div
              className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${card.borderColor} rounded-br-lg opacity-50 group-hover:opacity-100 transition-opacity`}
            />

            {/* 背景六边形装饰 - 多层叠加 */}
            <div className={`absolute -bottom-8 -right-8 w-32 h-32 ${card.textClass} opacity-5`}>
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" />
              </svg>
            </div>
            <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${card.textClass} opacity-5`}>
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full"
                style={{ transform: "rotate(30deg)" }}
              >
                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" />
              </svg>
            </div>

            {/* CPU 芯片装饰 */}
            <div
              className={`absolute top-3 right-3 ${card.textClass} opacity-10 group-hover:opacity-20 transition-opacity`}
            >
              <Cpu className="w-5 h-5" />
            </div>

            {/* 内容区 */}
            <div className="relative p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* 数字显示 - 带发光效果 */}
                  <div
                    className={`text-4xl lg:text-5xl leading-none font-bold ${card.textClass} font-mono mb-1.5 group-hover:scale-105 transition-transform duration-300`}
                    style={{
                      textShadow: `0 0 20px ${card.glowColor}`,
                    }}
                  >
                    {count}
                  </div>
                  {/* 标签 */}
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${card.accentBar} animate-pulse`} />
                    {t(`overview.statistics.${card.key}`)}
                  </div>
                </div>
                {/* 图标 */}
                <div
                  className={`ml-4 p-2.5 rounded-lg ${card.bgGlow} ${card.borderColor} ${card.textClass} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                  style={{
                    boxShadow: `0 0 15px ${card.glowColor}20`,
                  }}
                >
                  <Icon className="w-7 h-7 lg:w-8 lg:h-8" />
                </div>
              </div>
            </div>

            {/* 悬停时的边框发光效果 */}
            <div
              className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
              style={{
                boxShadow: `inset 0 0 20px ${card.glowColor}30, 0 0 20px ${card.glowColor}20`,
                border: `1px solid ${card.glowColor}40`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
