import { useTranslation } from "react-i18next";
import { Package, FolderGit, Shield } from "lucide-react";

interface StatisticsCardsProps {
  installedCount: number;
  repositoryCount: number;
  scannedCount: number;
}

// Apple 官方色彩
const cards = [
  {
    key: "installedSkills",
    icon: Package,
    gradient: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-500",
  },
  {
    key: "repositories",
    icon: FolderGit,
    gradient: "from-green-500 to-green-600",
    iconBg: "bg-green-500",
  },
  {
    key: "scannedSkills",
    icon: Shield,
    gradient: "from-purple-500 to-purple-600",
    iconBg: "bg-purple-500",
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const count = counts[index];

        return (
          <div key={card.key} className="apple-card p-6 group">
            <div className="flex items-start justify-between">
              <div>
                <div className="apple-stat-value text-foreground">{count}</div>
                <div className="apple-stat-label">{t(`overview.statistics.${card.key}`)}</div>
              </div>
              <div
                className={`w-11 h-11 rounded-2xl ${card.iconBg} flex items-center justify-center shadow-lg shadow-black/10 group-hover:scale-105 transition-transform duration-300`}
              >
                <Icon className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
