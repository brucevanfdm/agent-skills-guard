import { useState } from "react";
import { useSkills, useInstallSkill, useUninstallSkill, useDeleteSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { Shield, Download, Trash2, AlertTriangle, CheckCircle } from "lucide-react";

export function SkillsPage() {
  const { data: skills, isLoading } = useSkills();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();
  const deleteMutation = useDeleteSkill();

  const [filter, setFilter] = useState<"all" | "installed" | "not-installed">("all");

  const filteredSkills = skills?.filter((skill) => {
    if (filter === "installed") return skill.installed;
    if (filter === "not-installed") return !skill.installed;
    return true;
  });

  const getSecurityBadge = (score?: number) => {
    if (!score) return null;

    if (score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          安全 ({score})
        </span>
      );
    } else if (score >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
          <AlertTriangle className="w-3 h-3" />
          低风险 ({score})
        </span>
      );
    } else if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
          <AlertTriangle className="w-3 h-3" />
          中风险 ({score})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
          <Shield className="w-3 h-3" />
          高风险 ({score})
        </span>
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded transition-colors ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            全部 ({skills?.length || 0})
          </button>
          <button
            onClick={() => setFilter("installed")}
            className={`px-4 py-2 rounded transition-colors ${
              filter === "installed"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            已安装 ({skills?.filter((s) => s.installed).length || 0})
          </button>
          <button
            onClick={() => setFilter("not-installed")}
            className={`px-4 py-2 rounded transition-colors ${
              filter === "not-installed"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            未安装 ({skills?.filter((s) => !s.installed).length || 0})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : filteredSkills && filteredSkills.length > 0 ? (
        <div className="grid gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onInstall={() => installMutation.mutate(skill.id)}
              onUninstall={() => uninstallMutation.mutate(skill.id)}
              onDelete={() => deleteMutation.mutate(skill.id)}
              getSecurityBadge={getSecurityBadge}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">暂无 Skills</p>
          <p className="text-sm">请先在「仓库配置」中添加仓库并扫描</p>
        </div>
      )}
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  onInstall: () => void;
  onUninstall: () => void;
  onDelete: () => void;
  getSecurityBadge: (score?: number) => React.ReactNode;
}

function SkillCard({ skill, onInstall, onUninstall, onDelete, getSecurityBadge }: SkillCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{skill.name}</h3>
            {skill.installed && (
              <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
                已安装
              </span>
            )}
            {getSecurityBadge(skill.security_score)}
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {skill.description || "暂无描述"}
          </p>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>仓库: {skill.repository_url.split("/").slice(-2).join("/")}</span>
            <span>路径: {skill.file_path}</span>
          </div>

          {showDetails && skill.security_issues && skill.security_issues.length > 0 && (
            <div className="mt-3 p-3 bg-muted rounded">
              <p className="text-sm font-medium mb-2">安全问题:</p>
              <ul className="text-xs space-y-1">
                {skill.security_issues.map((issue, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    • {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {skill.installed ? (
            <button
              onClick={onUninstall}
              className="px-3 py-1 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              卸载
            </button>
          ) : (
            <button
              onClick={onInstall}
              className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1"
              disabled={skill.security_score !== undefined && skill.security_score < 50}
            >
              <Download className="w-4 h-4" />
              安装
            </button>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1 text-sm rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            {showDetails ? "隐藏" : "详情"}
          </button>

          <button
            onClick={onDelete}
            className="px-3 py-1 text-sm rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
