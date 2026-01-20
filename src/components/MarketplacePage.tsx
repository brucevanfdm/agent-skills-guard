import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSkills,
  useInstallSkill,
  useUninstallSkill,
  useUninstallSkillPath,
  useDeleteSkill,
} from "../hooks/useSkills";
import { usePlugins, useUninstallPlugin, useRemoveMarketplace } from "../hooks/usePlugins";
import type { Plugin, PluginInstallResult, Skill } from "../types";
import { SecurityReport } from "../types/security";
import {
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  SearchX,
  FolderOpen,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag, parseRepositoryOwner } from "../lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { countIssuesBySeverity } from "@/lib/security-utils";
import { addRecentInstallPath } from "@/lib/storage";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import { InstallPathSelector } from "./InstallPathSelector";
import { appToast } from "@/lib/toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";

interface MarketplacePageProps {
  onNavigateToRepositories?: () => void;
}

type MarketplaceItem =
  | { kind: "skill"; item: Skill }
  | { kind: "plugin"; item: Plugin };

const ANSI_ESCAPE_REGEX =
  /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const OSC_ESCAPE_REGEX = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;

function stripAnsi(input: string): string {
  return input.replace(OSC_ESCAPE_REGEX, "").replace(ANSI_ESCAPE_REGEX, "");
}

function extractRepoOwnerAndName(repoUrl: string): { owner: string; repo: string } {
  // 支持 https://github.com/owner/repo 或 git@github.com:owner/repo.git 格式
  const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
  if (match) {
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  }
  return { owner: "unknown", repo: "unknown" };
}

export function MarketplacePage({ onNavigateToRepositories }: MarketplacePageProps = {}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: allSkills = [], isLoading: isSkillsLoading } = useSkills();
  const { data: plugins = [], isLoading: isPluginsLoading } = usePlugins();
  const installMutation = useInstallSkill();
  const uninstallMutation = useUninstallSkill();
  const uninstallPathMutation = useUninstallSkillPath();
  const deleteMutation = useDeleteSkill();
  const uninstallPluginMutation = useUninstallPlugin();
  const removeMarketplaceMutation = useRemoveMarketplace();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [selectedMarketplace, setSelectedMarketplace] = useState("all");
  const [hideInstalled, setHideInstalled] = useState(false);
  const [pendingMarketplaceRemove, setPendingMarketplaceRemove] = useState<{
    marketplaceName: string;
    marketplaceRepo: string;
    pluginCount: number;
  } | null>(null);
  const [removingMarketplace, setRemovingMarketplace] = useState<string | null>(null);
  const [pendingInstall, setPendingInstall] = useState<{
    skill: Skill;
    report: SecurityReport;
  } | null>(null);
  const [pendingPluginInstall, setPendingPluginInstall] = useState<{
    plugin: Plugin;
    report: SecurityReport;
  } | null>(null);
  const [preparingSkillId, setPreparingSkillId] = useState<string | null>(null);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [preparingPluginId, setPreparingPluginId] = useState<string | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [uninstallingPluginId, setUninstallingPluginId] = useState<string | null>(null);
  const [logPlugin, setLogPlugin] = useState<Plugin | null>(null);
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const isLoading = isSkillsLoading || isPluginsLoading;

  const marketplaceItems = useMemo<MarketplaceItem[]>(() => {
    const skillItems = allSkills
      .filter((skill) => skill.repository_owner !== "local")
      .map((skill) => ({ kind: "skill", item: skill }) as MarketplaceItem);
    const pluginItems = plugins.map(
      (plugin) => ({ kind: "plugin", item: plugin }) as MarketplaceItem
    );
    return [...skillItems, ...pluginItems];
  }, [allSkills, plugins]);

  const repositories = useMemo(() => {
    if (!marketplaceItems.length) return [];
    const ownerMap = new Map<string, number>();

    marketplaceItems.forEach((entry) => {
      const owner =
        entry.item.repository_owner || parseRepositoryOwner(entry.item.repository_url);
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    });

    const repos = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({
        owner,
        count,
        displayName: `@${owner}`,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return [
      {
        owner: "all",
        count: marketplaceItems.length,
        displayName: t("skills.marketplace.allSources"),
      },
      ...repos,
    ];
  }, [marketplaceItems, i18n.language, t]);

  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  const marketplaces = useMemo(() => {
    if (!marketplaceItems.length) return [];

    const skillsOnlyCount = marketplaceItems.filter((entry) => entry.kind === "skill").length;
    const marketplaceMap = new Map<string, number>();

    marketplaceItems.forEach((entry) => {
      if (entry.kind === "plugin") {
        const marketplaceName = entry.item.marketplace_name;
        marketplaceMap.set(marketplaceName, (marketplaceMap.get(marketplaceName) || 0) + 1);
      }
    });

    const marketplaceList = Array.from(marketplaceMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        displayName: name,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const result = [
      {
        name: "all",
        count: marketplaceItems.length,
        displayName: t("skills.marketplace.allTypes"),
      },
    ];

    if (skillsOnlyCount > 0) {
      result.push({
        name: "skills-only",
        count: skillsOnlyCount,
        displayName: "Skills Only",
      });
    }

    return [...result, ...marketplaceList];
  }, [marketplaceItems, i18n.language, t]);

  const marketplaceOptions: CyberSelectOption[] = useMemo(() => {
    return marketplaces.map((marketplace) => ({
      value: marketplace.name,
      label: `${marketplace.displayName} (${marketplace.count})`,
    }));
  }, [marketplaces]);

  const filteredItems = useMemo(() => {
    if (!marketplaceItems.length) return [];

    const query = searchQuery.toLowerCase();

    let filtered = marketplaceItems.filter((entry) => {
      const owner =
        entry.item.repository_owner || parseRepositoryOwner(entry.item.repository_url);
      const matchesRepo = selectedRepository === "all" || owner === selectedRepository;
      const matchesInstalled = !hideInstalled || !entry.item.installed;

      // Marketplace 筛选
      let matchesMarketplace = true;
      if (selectedMarketplace === "skills-only") {
        matchesMarketplace = entry.kind === "skill";
      } else if (selectedMarketplace !== "all") {
        matchesMarketplace = entry.kind === "plugin" && entry.item.marketplace_name === selectedMarketplace;
      }

      const matchesSearch =
        !searchQuery ||
        entry.item.name.toLowerCase().includes(query) ||
        entry.item.description?.toLowerCase().includes(query) ||
        (entry.kind === "plugin" &&
          entry.item.marketplace_name.toLowerCase().includes(query));

      return matchesSearch && matchesRepo && matchesInstalled && matchesMarketplace;
    });

    if (searchQuery) {
      const nameMatches: MarketplaceItem[] = [];
      const descriptionMatches: MarketplaceItem[] = [];

      filtered.forEach((entry) => {
        const nameMatch = entry.item.name.toLowerCase().includes(query);
        if (nameMatch) {
          nameMatches.push(entry);
        } else {
          descriptionMatches.push(entry);
        }
      });

      filtered = [...nameMatches, ...descriptionMatches];
    }

    return filtered;
  }, [marketplaceItems, searchQuery, selectedRepository, selectedMarketplace, hideInstalled]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-shrink-0 border-b border-border/50"
        onWheel={(e) => {
          if (!listContainerRef.current) return;
          listContainerRef.current.scrollBy({ top: e.deltaY });
          e.preventDefault();
        }}
      >
        <div className="px-8 pt-8 pb-4" style={{ animation: "fadeIn 0.4s ease-out" }}>
          <div className="max-w-6xl mx-auto">
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isHeaderCollapsed ? "max-h-0 opacity-0" : "max-h-24 opacity-100"
              }`}
            >
              <h1 className="text-headline text-foreground mb-4">{t("nav.marketplace")}</h1>
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={t("skills.marketplace.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="apple-input w-full h-10 pl-10 pr-4"
                />
              </div>

              <CyberSelect
                value={selectedRepository}
                onChange={setSelectedRepository}
                options={repositoryOptions}
                className="min-w-[200px]"
              />

              <CyberSelect
                value={selectedMarketplace}
                onChange={setSelectedMarketplace}
                options={marketplaceOptions}
                className="min-w-[200px]"
              />

              <label className="flex items-center gap-2 h-10 px-4 apple-card text-sm cursor-pointer hover:bg-secondary/50 transition-colors">
                <input
                  type="checkbox"
                  checked={hideInstalled}
                  onChange={(e) => setHideInstalled(e.target.checked)}
                  className="rounded border-border accent-blue-500"
                />
                <span>{t("skills.marketplace.hideInstalled")}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-8 pb-8"
        onScroll={(e) => {
          const top = (e.currentTarget as HTMLDivElement).scrollTop;
          setIsHeaderCollapsed(top > 8);
        }}
      >
        <div className={`max-w-6xl mx-auto ${isHeaderCollapsed ? "pt-4" : "pt-6"}`}>
          {/* Skills Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">{t("skills.loading")}</p>
            </div>
          ) : filteredItems && filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {filteredItems.map((entry) =>
                entry.kind === "skill" ? (
                  <SkillCard
                    key={entry.item.id}
                    skill={entry.item}
                    onInstall={async () => {
                      try {
                        setPreparingSkillId(entry.item.id);
                        const report = await invoke<SecurityReport>(
                          "prepare_skill_installation",
                          {
                            skillId: entry.item.id,
                            locale: i18n.language,
                          }
                        );
                        setPreparingSkillId(null);
                        setPendingInstall({ skill: entry.item, report });
                      } catch (error: any) {
                        setPreparingSkillId(null);
                        appToast.error(
                          `${t("skills.toast.installFailed")}: ${error.message || error}`
                        );
                      }
                    }}
                    onUninstall={() => {
                      uninstallMutation.mutate(entry.item.id, {
                        onSuccess: () => appToast.success(t("skills.toast.uninstalled")),
                        onError: (error: any) =>
                          appToast.error(
                            `${t("skills.toast.uninstallFailed")}: ${error.message || error}`
                          ),
                      });
                    }}
                    onUninstallPath={(path: string) => {
                      uninstallPathMutation.mutate(
                        { skillId: entry.item.id, path },
                        {
                          onSuccess: () => appToast.success(t("skills.toast.uninstalled")),
                          onError: (error: any) =>
                            appToast.error(
                              `${t("skills.toast.uninstallFailed")}: ${error.message || error}`
                            ),
                        }
                      );
                    }}
                    onDelete={() => {
                      setDeletingSkillId(entry.item.id);
                      deleteMutation.mutate(entry.item.id, {
                        onSuccess: () => {
                          setDeletingSkillId(null);
                          appToast.success(t("skills.toast.deleted"));
                        },
                        onError: (error: any) => {
                          setDeletingSkillId(null);
                          appToast.error(
                            `${t("skills.toast.deleteFailed")}: ${error.message || error}`
                          );
                        },
                      });
                    }}
                    isInstalling={
                      installingSkillId === entry.item.id ||
                      (installMutation.isPending &&
                        installMutation.variables?.skillId === entry.item.id)
                    }
                    isUninstalling={
                      uninstallMutation.isPending &&
                      uninstallMutation.variables === entry.item.id
                    }
                    isDeleting={deletingSkillId === entry.item.id}
                    isPreparing={preparingSkillId === entry.item.id}
                    isAnyOperationPending={
                      installMutation.isPending ||
                      uninstallMutation.isPending ||
                      preparingSkillId !== null ||
                      installingSkillId !== null ||
                      deletingSkillId !== null ||
                      preparingPluginId !== null ||
                      installingPluginId !== null
                    }
                    t={t}
                  />
                ) : (
                  <PluginCard
                    key={entry.item.id}
                    plugin={entry.item}
                    isPreparing={preparingPluginId === entry.item.id}
                    isInstalling={installingPluginId === entry.item.id}
                    isUninstalling={uninstallingPluginId === entry.item.id}
                    isAnyOperationPending={
                      installMutation.isPending ||
                      uninstallMutation.isPending ||
                      preparingSkillId !== null ||
                      installingSkillId !== null ||
                      deletingSkillId !== null ||
                      preparingPluginId !== null ||
                      installingPluginId !== null ||
                      uninstallingPluginId !== null
                    }
                    onViewLog={() => setLogPlugin(entry.item)}
                    onInstall={async () => {
                      if (
                        entry.item.install_status === "unsupported" ||
                        entry.item.install_status === "blocked"
                      ) {
                        return;
                      }
                      try {
                        setPreparingPluginId(entry.item.id);
                        const report = await invoke<SecurityReport>(
                          "prepare_plugin_installation",
                          {
                            pluginId: entry.item.id,
                            locale: i18n.language,
                          }
                        );
                        setPendingPluginInstall({ plugin: entry.item, report });
                      } catch (error: any) {
                        appToast.error(
                          `${t("plugins.toast.scanFailed")}: ${error.message || error}`
                        );
                      } finally {
                        setPreparingPluginId(null);
                      }
                    }}
                    onUninstall={async () => {
                      try {
                        setUninstallingPluginId(entry.item.id);
                        const result = await uninstallPluginMutation.mutateAsync(entry.item.id);
                        if (result.success) {
                          appToast.success(t("plugins.toast.uninstalled"));
                        } else {
                          appToast.error(t("plugins.toast.uninstallFailed"));
                        }
                      } catch (error: any) {
                        appToast.error(
                          `${t("plugins.toast.uninstallFailed")}: ${error.message || error}`
                        );
                      } finally {
                        setUninstallingPluginId(null);
                      }
                    }}
                  />
                )
              )}
            </div>
          ) : (
            <div className="apple-card p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-5 mx-auto">
                <SearchX className="w-10 h-10 text-muted-foreground" />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("skills.marketplace.noResults", { query: searchQuery })}
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRepository("all");
                      setHideInstalled(false);
                    }}
                    className="apple-button-secondary"
                  >
                    {t("skills.marketplace.clearFilters")}
                  </button>
                </>
              ) : marketplaceItems.length === 0 ? (
                <div className="max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground mb-2">
                    {t("skills.marketplace.noSkillsYet")}
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    {t("skills.marketplace.scanningRepositories")}
                  </p>
                  <button
                    onClick={() => onNavigateToRepositories?.()}
                    disabled={!onNavigateToRepositories}
                    className="apple-button-primary disabled:opacity-50"
                  >
                    {t("skills.marketplace.goToRepositories")}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("skills.marketplace.noSkillsInFilter")}
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedRepository("all");
                      setHideInstalled(false);
                    }}
                    className="apple-button-secondary"
                  >
                    {t("skills.marketplace.clearFilters")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Install Confirmation Dialog */}
      <InstallConfirmDialog
        open={pendingInstall !== null}
        onClose={() => {
          const skillId = pendingInstall?.skill.id;
          const shouldCancel = skillId && installingSkillId !== skillId;
          setPendingInstall(null);
          if (!shouldCancel) return;
          void invoke("cancel_skill_installation", { skillId }).catch((error: any) => {
            console.error("[ERROR] 取消安装失败:", error);
          });
        }}
        onConfirm={async (selectedPath) => {
          if (!pendingInstall) return;
          const skillId = pendingInstall.skill.id;
          setInstallingSkillId(skillId);
          setPendingInstall(null);
          try {
            await invoke("confirm_skill_installation", {
              skillId,
              installPath: selectedPath,
            });
            addRecentInstallPath(selectedPath);
            await queryClient.refetchQueries({ queryKey: ["skills"] });
            await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
            await queryClient.refetchQueries({ queryKey: ["scanResults"] });
            appToast.success(t("skills.toast.installed"));
          } catch (error: any) {
            appToast.error(`${t("skills.toast.installFailed")}: ${error.message || error}`);
          } finally {
            setInstallingSkillId(null);
          }
        }}
        report={pendingInstall?.report || null}
        skillName={pendingInstall?.skill.name || ""}
      />

      <PluginInstallConfirmDialog
        open={pendingPluginInstall !== null}
        report={pendingPluginInstall?.report || null}
        pluginName={pendingPluginInstall?.plugin.name || ""}
        onClose={() => {
          const pluginId = pendingPluginInstall?.plugin.id;
          const shouldCancel = pluginId && installingPluginId !== pluginId;
          setPendingPluginInstall(null);
          if (!shouldCancel) return;
          void invoke("cancel_plugin_installation", { pluginId }).catch((error: any) => {
            console.error("[ERROR] 取消插件安装失败:", error);
          });
        }}
        onConfirm={async () => {
          if (!pendingPluginInstall) return;
          const pluginSnapshot = pendingPluginInstall.plugin;
          const pluginId = pluginSnapshot.id;
          setInstallingPluginId(pluginId);
          setPendingPluginInstall(null);
          try {
            const result = await invoke<PluginInstallResult>("confirm_plugin_installation", {
              pluginId,
              claudeCommand: null,
            });
            await queryClient.refetchQueries({ queryKey: ["plugins"] });
            const hasFailed =
              result.marketplace_status === "failed" ||
              result.plugin_statuses.some((status) => status.status === "failed");

            const updatedPlugins = queryClient.getQueryData<Plugin[]>(["plugins"]);
            const updatedPlugin =
              updatedPlugins?.find((item) => item.id === pluginId) ?? null;

            if (hasFailed) {
              appToast.error(t("plugins.toast.installFailed"));
              setLogPlugin(
                updatedPlugin ?? {
                  ...pluginSnapshot,
                  install_log: result.raw_log,
                  install_status: "failed",
                }
              );
            } else {
              appToast.success(t("plugins.toast.installed"));
            }
          } catch (error: any) {
            appToast.error(`${t("plugins.toast.installFailed")}: ${error.message || error}`);
          } finally {
            setInstallingPluginId(null);
          }
        }}
      />

      <PluginLogDialog
        open={logPlugin !== null}
        plugin={logPlugin}
        onClose={() => setLogPlugin(null)}
      />

      {/* Marketplace Remove Confirmation Dialog */}
      <AlertDialog
        open={pendingMarketplaceRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMarketplaceRemove(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("plugins.confirmRemoveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("plugins.confirmRemoveMessage", {
                name: pendingMarketplaceRemove?.marketplaceName || "",
                count: pendingMarketplaceRemove?.pluginCount || 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("skills.cancel")}</AlertDialogCancel>
            <button
              onClick={async () => {
                if (!pendingMarketplaceRemove) return;
                const { marketplaceName, marketplaceRepo } = pendingMarketplaceRemove;
                setRemovingMarketplace(marketplaceName);
                setPendingMarketplaceRemove(null);
                try {
                  const result = await removeMarketplaceMutation.mutateAsync({
                    marketplaceName,
                    marketplaceRepo,
                  });
                  if (result.success) {
                    appToast.success(
                      t("plugins.toast.marketplaceRemoved", { count: result.removed_plugins_count })
                    );
                  } else {
                    appToast.error(t("plugins.toast.marketplaceRemoveFailed"));
                  }
                } catch (error: any) {
                  appToast.error(
                    `${t("plugins.toast.marketplaceRemoveFailed")}: ${error.message || error}`
                  );
                } finally {
                  setRemovingMarketplace(null);
                }
              }}
              className="apple-button-primary bg-red-500 hover:bg-red-600"
            >
              {t("plugins.removeMarketplace")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  onInstall: () => void;
  onUninstall: () => void;
  onUninstallPath: (path: string) => void;
  onDelete: () => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  isDeleting: boolean;
  isPreparing: boolean;
  isAnyOperationPending: boolean;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  onInstall,
  onUninstall,
  onUninstallPath,
  isInstalling,
  isUninstalling,
  isPreparing,
  isAnyOperationPending,
  t,
}: SkillCardProps) {
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (!element) return;

    const update = () => {
      setIsDescriptionTruncated(
        element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [skill.description]);

  return (
    <div className="apple-card p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium text-foreground">{skill.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                skill.repository_owner === "local"
                  ? "bg-muted text-muted-foreground"
                  : "bg-blue-500/10 text-blue-600"
              }`}
            >
              {formatRepositoryTag(skill)}
            </span>
            {skill.installed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                {t("skills.installed")}
              </span>
            )}
            {isInstalling && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                {t("skills.installing")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onInstall}
            disabled={isAnyOperationPending}
            className="apple-button-primary h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPreparing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{t("skills.scanning")}</span>
              </>
            ) : isInstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">{t("skills.installing")}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {skill.installed ? t("skills.installToOther") : t("skills.install")}
                </span>
              </>
            )}
          </button>

          {skill.installed && (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{t("skills.uninstalling")}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("skills.uninstallAll")}</span>
                </>
              )}
            </button>
          )}
          {/* 删除按钮暂时隐藏，功能未开放 */}
          {/* {!skill.installed && (
            <button
              onClick={onDelete}
              disabled={isAnyOperationPending}
              className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
              title={t('skills.deleteRecord')}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{t('skills.deleting')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('skills.delete')}</span>
                </>
              )}
            </button>
          )} */}
        </div>
      </div>

      {/* Description - 自动填充剩余空间 */}
      <p
        ref={descriptionRef}
        title={isDescriptionTruncated && skill.description ? skill.description : undefined}
        className="text-sm text-muted-foreground mb-3 leading-5 h-[6.25rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical]"
      >
        {skill.description || t("skills.noDescription")}
      </p>

      {/* Repository - 固定在底部 */}
      <div className="text-xs text-muted-foreground mb-3">
        <span className="text-blue-500 font-medium">{t("skills.repo")}</span>{" "}
        {skill.repository_url === "local" ? (
          <span>{skill.repository_url}</span>
        ) : (
          <a
            href={skill.repository_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 hover:underline break-all transition-colors"
          >
            {skill.repository_url}
          </a>
        )}
      </div>

      {/* Installed Paths */}
      {skill.local_paths && skill.local_paths.length > 0 && (
        <div className="pt-3 border-t border-border/60">
          <div className="text-xs text-muted-foreground mb-2">
            <span className="text-blue-500 font-medium">{t("skills.installedPaths")}</span> (
            {skill.local_paths.length})
          </div>
          <div className="space-y-1.5">
            {skill.local_paths.map((path, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2.5 bg-secondary/50 rounded-xl text-xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={async () => {
                      try {
                        try {
                          await invoke("open_skill_directory", { localPath: path });
                        } catch {
                          await openPath(path);
                        }
                        appToast.success(t("skills.folder.opened"), { duration: 5000 });
                      } catch (error: any) {
                        appToast.error(
                          t("skills.folder.openFailed", { error: error?.message || String(error) }),
                          { duration: 5000 }
                        );
                      }
                    }}
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                    title={t("skills.openFolder")}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-muted-foreground truncate" title={path}>
                    {path}
                  </span>
                </div>
                <button
                  onClick={() => onUninstallPath(path)}
                  disabled={isAnyOperationPending}
                  className="text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  title={t("skills.uninstallPath")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PluginCardProps {
  plugin: Plugin;
  isPreparing: boolean;
  isInstalling: boolean;
  isUninstalling: boolean;
  isAnyOperationPending: boolean;
  onViewLog: () => void;
  onInstall: () => void;
  onUninstall: () => void;
}

function PluginCard({
  plugin,
  isPreparing,
  isInstalling,
  isUninstalling,
  isAnyOperationPending,
  onViewLog,
  onInstall,
  onUninstall,
}: PluginCardProps) {
  const { t } = useTranslation();
  const isUnsupported = plugin.install_status === "unsupported";
  const isBlocked = plugin.install_status === "blocked";
  const statusLabel = getPluginStatusLabel(plugin.install_status, t);
  const canViewLog =
    plugin.install_log != null ||
    ["installed", "already_installed", "failed", "uninstalled", "uninstall_failed"].includes(plugin.install_status ?? "");

  return (
    <div className="apple-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-medium text-foreground">{plugin.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
              {t("plugins.badge")}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                plugin.repository_owner === "local"
                  ? "bg-muted text-muted-foreground"
                  : "bg-blue-500/10 text-blue-600"
              }`}
            >
              {formatRepositoryTag(plugin)}
            </span>
            {plugin.installed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                {t("plugins.installed")}
              </span>
            )}
            {isUnsupported && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-700">
                {t("plugins.unsupported")}
              </span>
            )}
            {isBlocked && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">
                {t("plugins.status.blocked")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("plugins.marketplace")}: {plugin.marketplace_name}
          </p>
        </div>

        <div className="flex gap-2">
          {plugin.installed ? (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">{t("plugins.uninstalling")}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("plugins.uninstall")}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={isAnyOperationPending || isUnsupported || isBlocked}
              className="apple-button-primary h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {isPreparing || isInstalling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">
                    {isPreparing ? t("plugins.scanning") : t("plugins.installing")}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("plugins.install")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3 leading-5">
        {plugin.description || t("plugins.noDescription")}
      </p>

      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          <span className="text-blue-500 font-medium">{t("plugins.repo")}</span>{" "}
          <a
            href={plugin.repository_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 hover:underline break-all transition-colors"
          >
            {plugin.repository_url}
          </a>
        </div>
        {plugin.version && (
          <div>
            <span className="text-blue-500 font-medium">{t("plugins.version")}</span>{" "}
            {plugin.version}
          </div>
        )}
        {statusLabel && (
          <div>
            <span className="text-blue-500 font-medium">{t("plugins.status.label")}</span>{" "}
            {statusLabel}
          </div>
        )}
      </div>

      {canViewLog && (
        <button
          onClick={onViewLog}
          className="mt-3 text-xs text-blue-500 hover:text-blue-600 transition-colors self-start"
        >
          {t("plugins.viewLog")}
        </button>
      )}
    </div>
  );
}

interface PluginInstallConfirmDialogProps {
  open: boolean;
  report: SecurityReport | null;
  pluginName: string;
  onClose: () => void;
  onConfirm: () => void;
}

function PluginInstallConfirmDialog({
  open,
  report,
  pluginName,
  onClose,
  onConfirm,
}: PluginInstallConfirmDialogProps) {
  const { t } = useTranslation();
  const isMediumRisk = report ? report.score >= 50 && report.score < 70 : false;
  const isHighRisk = report ? report.score < 50 || report.blocked : false;

  const issueCounts = useMemo(
    () => (report ? countIssuesBySeverity(report.issues) : { critical: 0, error: 0, warning: 0 }),
    [report]
  );

  if (!report) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-5 h-5 text-destructive" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
            {t("plugins.installDialog.scanResult")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t("plugins.installDialog.preparingInstall")}:{" "}
                <span className="font-semibold">{pluginName}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm">{t("plugins.installDialog.securityScore")}:</span>
                <span
                  className={`text-3xl font-bold ${
                    report.score >= 90
                      ? "text-success"
                      : report.score >= 70
                        ? "text-success"
                        : report.score >= 50
                          ? "text-warning"
                          : "text-destructive"
                  }`}
                >
                  {report.score}
                </span>
              </div>

              {report.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {t("plugins.installDialog.issuesDetected")}:
                  </div>
                  <div className="flex gap-4 text-sm">
                    {issueCounts.critical > 0 && (
                      <span className="text-destructive">
                        {t("plugins.installDialog.critical")}: {issueCounts.critical}
                      </span>
                    )}
                    {issueCounts.error > 0 && (
                      <span className="text-warning">
                        {t("plugins.installDialog.highRisk")}: {issueCounts.error}
                      </span>
                    )}
                    {issueCounts.warning > 0 && (
                      <span className="text-warning">
                        {t("plugins.installDialog.mediumRisk")}: {issueCounts.warning}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {report.issues.length > 0 && (
                <div
                  className={`p-3 rounded-lg ${
                    isHighRisk
                      ? "bg-destructive/10 border border-destructive/30"
                      : isMediumRisk
                        ? "bg-warning/10 border border-warning/30"
                        : "bg-success/10 border border-success/30"
                  }`}
                >
                  <ul className="space-y-1 text-sm">
                    {report.issues.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="text-xs">
                        {issue.file_path && (
                          <span className="text-primary mr-1.5">[{issue.file_path}]</span>
                        )}
                        {issue.description}
                        {issue.line_number && (
                          <span className="text-muted-foreground ml-2">
                            (行 {issue.line_number})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isHighRisk && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block mb-1">
                        {t("plugins.installDialog.warningTitle")}
                      </strong>
                      {t("plugins.installDialog.warningMessage")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t("plugins.installDialog.cancel")}
          </AlertDialogCancel>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isHighRisk
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : isMediumRisk
                  ? "bg-warning text-white hover:bg-warning/90"
                  : "bg-success text-white hover:bg-success/90"
            }`}
          >
            {isHighRisk
              ? t("plugins.installDialog.installAnyway")
              : t("plugins.installDialog.confirmInstall")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface PluginLogDialogProps {
  open: boolean;
  plugin: Plugin | null;
  onClose: () => void;
}

function PluginLogDialog({ open, plugin, onClose }: PluginLogDialogProps) {
  const { t } = useTranslation();

  if (!plugin) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("plugins.logTitle", { name: plugin.name })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="text-blue-500 font-medium">{t("plugins.status.label")}</span>{" "}
                {getPluginStatusLabel(plugin.install_status, t) || t("plugins.status.unknown")}
              </div>
              <pre className="text-xs bg-muted/40 rounded-lg p-4 max-h-[420px] overflow-y-auto whitespace-pre-wrap">
                {plugin.install_log ? stripAnsi(plugin.install_log) : t("plugins.noLog")}
              </pre>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{t("plugins.close")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function getPluginStatusLabel(status: Plugin["install_status"], t: (key: string) => string) {
  switch (status) {
    case "installed":
      return t("plugins.status.installed");
    case "already_installed":
      return t("plugins.status.alreadyInstalled");
    case "failed":
      return t("plugins.status.failed");
    case "unsupported":
      return t("plugins.status.unsupported");
    case "blocked":
      return t("plugins.status.blocked");
    case "uninstalled":
      return t("plugins.status.uninstalled");
    case "uninstall_failed":
      return t("plugins.status.uninstallFailed");
    default:
      return "";
  }
}

interface InstallConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedPath: string) => void;
  report: SecurityReport | null;
  skillName: string;
}

function InstallConfirmDialog({
  open,
  onClose,
  onConfirm,
  report,
  skillName,
}: InstallConfirmDialogProps) {
  const { t } = useTranslation();
  const [selectedPath, setSelectedPath] = useState<string>("");

  const isMediumRisk = report ? report.score >= 50 && report.score < 70 : false;
  const isHighRisk = report ? report.score < 50 || report.blocked : false;

  const issueCounts = useMemo(
    () => (report ? countIssuesBySeverity(report.issues) : { critical: 0, error: 0, warning: 0 }),
    [report]
  );

  if (!report) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-5 h-5 text-destructive" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
            {t("skills.marketplace.install.scanResult")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t("skills.marketplace.install.preparingInstall")}:{" "}
                <span className="font-semibold">{skillName}</span>
              </div>

              {/* Score */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm">{t("skills.marketplace.install.securityScore")}:</span>
                <span
                  className={`text-3xl font-bold ${
                    report.score >= 90
                      ? "text-success"
                      : report.score >= 70
                        ? "text-success"
                        : report.score >= 50
                          ? "text-warning"
                          : "text-destructive"
                  }`}
                >
                  {report.score}
                </span>
              </div>

              {/* Issue Summary */}
              {report.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    {t("skills.marketplace.install.issuesDetected")}:
                  </div>
                  <div className="flex gap-4 text-sm">
                    {issueCounts.critical > 0 && (
                      <span className="text-destructive">
                        {t("skills.marketplace.install.critical")}: {issueCounts.critical}
                      </span>
                    )}
                    {issueCounts.error > 0 && (
                      <span className="text-warning">
                        {t("skills.marketplace.install.highRisk")}: {issueCounts.error}
                      </span>
                    )}
                    {issueCounts.warning > 0 && (
                      <span className="text-warning">
                        {t("skills.marketplace.install.mediumRisk")}: {issueCounts.warning}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Issue List */}
              {report.issues.length > 0 && (
                <div
                  className={`p-3 rounded-lg ${
                    isHighRisk
                      ? "bg-destructive/10 border border-destructive/30"
                      : isMediumRisk
                        ? "bg-warning/10 border border-warning/30"
                        : "bg-success/10 border border-success/30"
                  }`}
                >
                  <ul className="space-y-1 text-sm">
                    {report.issues.slice(0, 3).map((issue, idx) => (
                      <li key={idx} className="text-xs">
                        {issue.file_path && (
                          <span className="text-primary mr-1.5">[{issue.file_path}]</span>
                        )}
                        {issue.description}
                        {issue.line_number && (
                          <span className="text-muted-foreground ml-2">
                            (行 {issue.line_number})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning */}
              {isHighRisk && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="block mb-1">
                        {t("skills.marketplace.install.warningTitle")}
                      </strong>
                      {t("skills.marketplace.install.warningMessage")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Path Selector */}
        <div className="py-4 border-t border-border">
          <InstallPathSelector onSelect={setSelectedPath} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t("skills.marketplace.install.cancel")}
          </AlertDialogCancel>
          <button
            onClick={() => onConfirm(selectedPath)}
            disabled={!selectedPath}
            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
              isHighRisk
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : isMediumRisk
                  ? "bg-warning text-white hover:bg-warning/90"
                  : "bg-success text-white hover:bg-success/90"
            }`}
          >
            {isHighRisk
              ? t("skills.marketplace.install.installAnyway")
              : t("skills.marketplace.install.confirmInstall")}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
