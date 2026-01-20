import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInstalledSkills, useUninstallSkill, useUninstallSkillPath } from "../hooks/useSkills";
import { usePlugins, useRemoveMarketplace, useUninstallPlugin } from "../hooks/usePlugins";
import { Plugin, Skill } from "../types";
import { SecurityReport } from "../types/security";
import {
  Trash2,
  Loader2,
  FolderOpen,
  Package,
  Search,
  SearchX,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { appToast } from "../lib/toast";
import { countIssuesBySeverity } from "@/lib/security-utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./ui/alert-dialog";

const AVAILABLE_UPDATES_KEY = "available_updates";

export function InstalledSkillsPage() {
  const { t, i18n } = useTranslation();
  const { data: installedSkills, isLoading: isSkillsLoading } = useInstalledSkills();
  const { data: allPlugins = [], isLoading: isPluginsLoading } = usePlugins();
  const uninstallMutation = useUninstallSkill();
  const uninstallPathMutation = useUninstallSkillPath();
  const uninstallPluginMutation = useUninstallPlugin();
  const removeMarketplaceMutation = useRemoveMarketplace();
  const queryClient = useQueryClient();
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [activeTab, setActiveTab] = useState<"skills" | "plugins" | "marketplaces">("skills");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [isScanning, setIsScanning] = useState(false);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);
  const [uninstallingPluginId, setUninstallingPluginId] = useState<string | null>(null);
  const [pendingMarketplaceRemove, setPendingMarketplaceRemove] = useState<{
    marketplaceName: string;
    marketplaceRepo: string;
    installedPluginNames: string[];
  } | null>(null);
  const [removingMarketplaceName, setRemovingMarketplaceName] = useState<string | null>(null);

  const [availableUpdates, setAvailableUpdates] = useState<Map<string, string>>(() => {
    try {
      const stored = localStorage.getItem(AVAILABLE_UPDATES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("[ERROR] 恢复更新状态失败:", error);
    }
    return new Map();
  });
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [preparingUpdateSkillId, setPreparingUpdateSkillId] = useState<string | null>(null);
  const [confirmingUpdateSkillId, setConfirmingUpdateSkillId] = useState<string | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    skill: Skill;
    report: SecurityReport;
    conflicts: string[];
  } | null>(null);

  useEffect(() => {
    try {
      if (availableUpdates.size > 0) {
        const obj = Object.fromEntries(availableUpdates);
        localStorage.setItem(AVAILABLE_UPDATES_KEY, JSON.stringify(obj));
      } else {
        localStorage.removeItem(AVAILABLE_UPDATES_KEY);
      }
    } catch (error) {
      console.error("[ERROR] 保存更新状态失败:", error);
    }
  }, [availableUpdates]);

  useEffect(() => {
    if (!installedSkills || availableUpdates.size === 0) return;
    const installedSkillIds = new Set(installedSkills.map((skill) => skill.id));
    const needsCleanup = Array.from(availableUpdates.keys()).some(
      (skillId) => !installedSkillIds.has(skillId)
    );
    if (needsCleanup) {
      setAvailableUpdates((prev) => {
        const newMap = new Map(prev);
        for (const skillId of newMap.keys()) {
          if (!installedSkillIds.has(skillId)) {
            newMap.delete(skillId);
          }
        }
        return newMap;
      });
    }
  }, [installedSkills, availableUpdates]);

  const checkUpdatesWithRefresh = async () => {
    try {
      // 第一步：刷新本地技能
      setIsScanning(true);
      const localSkills = await api.scanLocalSkills();
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
      appToast.success(t("skills.installedPage.scanCompleted", { count: localSkills.length }));
      setIsScanning(false);

      // 第二步：检查更新
      setIsCheckingUpdates(true);
      const updates = await api.checkSkillsUpdates();
      const updateMap = new Map(updates.map(([skillId, latestSha]) => [skillId, latestSha]));
      setAvailableUpdates(updateMap);
      if (updates.length > 0) {
        appToast.success(t("skills.installedPage.updatesFound", { count: updates.length }));
      } else {
        appToast.success(t("skills.installedPage.noUpdates"));
      }
    } catch (error: any) {
      if (isScanning) {
        appToast.error(t("skills.installedPage.scanFailed", { error: error.message }));
      } else {
        appToast.error(t("skills.installedPage.checkUpdatesFailed", { error: error.message }));
      }
    } finally {
      setIsScanning(false);
      setIsCheckingUpdates(false);
    }
  };

  const mergedSkills = useMemo(() => {
    if (!installedSkills) return [];
    const skillMap = new Map<string, Skill>();
    installedSkills.forEach((skill) => {
      const key = skill.name;
      if (skillMap.has(key)) {
        const existing = skillMap.get(key)!;
        const existingPaths = existing.local_paths || [];
        const newPaths = skill.local_paths || [];
        const allPaths = Array.from(new Set([...existingPaths, ...newPaths]));
        skillMap.set(key, {
          ...existing,
          local_paths: allPaths,
          repository_url:
            existing.repository_url === "local" ? skill.repository_url : existing.repository_url,
          repository_owner:
            existing.repository_owner === "local"
              ? skill.repository_owner
              : existing.repository_owner,
        });
      } else {
        skillMap.set(key, { ...skill });
      }
    });
    return Array.from(skillMap.values());
  }, [installedSkills]);

  const installedPlugins = useMemo(() => {
    return allPlugins.filter((plugin) => plugin.installed);
  }, [allPlugins]);

  const isLoading = isSkillsLoading || isPluginsLoading;

  const installedMarketplaces = useMemo(() => {
    const byMarketplace = new Map<string, { name: string; repoUrl: string; plugins: Plugin[] }>();

    allPlugins.forEach((plugin) => {
      if (!plugin.marketplace_name) return;
      const key = plugin.marketplace_name;
      const existing = byMarketplace.get(key);
      if (existing) {
        existing.plugins.push(plugin);
        if (!existing.repoUrl && plugin.repository_url) existing.repoUrl = plugin.repository_url;
      } else {
        byMarketplace.set(key, {
          name: key,
          repoUrl: plugin.repository_url,
          plugins: [plugin],
        });
      }
    });

    return Array.from(byMarketplace.values())
      .map((marketplace) => {
        const installedCount = marketplace.plugins.filter((p) => p.installed).length;
        return {
          ...marketplace,
          installedCount,
          totalCount: marketplace.plugins.length,
        };
      })
      .filter((marketplace) => marketplace.installedCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlugins]);

  const tabCounts = useMemo(
    () => ({
      skills: mergedSkills.length,
      plugins: installedPlugins.length,
      marketplaces: installedMarketplaces.length,
    }),
    [installedMarketplaces.length, installedPlugins.length, mergedSkills.length]
  );

  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    if (activeTab === "marketplaces") return [];

    const items = activeTab === "skills" ? mergedSkills : installedPlugins;
    if (!items || items.length === 0) {
      return [{ value: "all", label: `${t("skills.marketplace.allSources")} (0)` }];
    }

    const ownerMap = new Map<string, number>();
    items.forEach((item) => {
      const owner = item.repository_owner || "unknown";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    });

    const repos = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({
        owner,
        count,
        displayName: owner === "local" ? t("skills.marketplace.localRepo") : `@${owner}`,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return [
      { value: "all", label: `${t("skills.marketplace.allSources")} (${items.length})` },
      ...repos.map((repo) => ({
        value: repo.owner,
        label: `${repo.displayName} (${repo.count})`,
      })),
    ];
  }, [activeTab, installedPlugins, mergedSkills, i18n.language, t]);

  const filteredSkills = useMemo(() => {
    let items = mergedSkills;

    if (selectedRepository !== "all") {
      items = items.filter((skill) => (skill.repository_owner || "unknown") === selectedRepository);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatches: Skill[] = [];
      const restMatches: Skill[] = [];
      items.forEach((skill) => {
        const nameMatch = skill.name.toLowerCase().includes(query);
        const descriptionMatch = skill.description?.toLowerCase().includes(query);
        if (nameMatch) nameMatches.push(skill);
        else if (descriptionMatch) restMatches.push(skill);
      });
      items = [...nameMatches, ...restMatches];
    } else {
      items = [...items].sort((a, b) => {
        const timeA = a.installed_at ? new Date(a.installed_at).getTime() : 0;
        const timeB = b.installed_at ? new Date(b.installed_at).getTime() : 0;
        return timeB - timeA;
      });
    }

    return items;
  }, [mergedSkills, searchQuery, selectedRepository]);

  const filteredPlugins = useMemo(() => {
    let items = installedPlugins;

    if (selectedRepository !== "all") {
      items = items.filter(
        (plugin) => (plugin.repository_owner || "unknown") === selectedRepository
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatches: Plugin[] = [];
      const restMatches: Plugin[] = [];
      items.forEach((plugin) => {
        const nameMatch = plugin.name.toLowerCase().includes(query);
        const descriptionMatch = plugin.description?.toLowerCase().includes(query);
        if (nameMatch) nameMatches.push(plugin);
        else if (descriptionMatch) restMatches.push(plugin);
      });
      items = [...nameMatches, ...restMatches];
    } else {
      items = [...items].sort((a, b) => {
        const timeA = a.installed_at ? new Date(a.installed_at).getTime() : 0;
        const timeB = b.installed_at ? new Date(b.installed_at).getTime() : 0;
        return timeB - timeA;
      });
    }

    return items;
  }, [installedPlugins, searchQuery, selectedRepository]);

  const filteredMarketplaces = useMemo(() => {
    let items = installedMarketplaces;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter((m) => m.name.toLowerCase().includes(query));
    }

    return items;
  }, [installedMarketplaces, searchQuery]);

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
              <h1 className="text-headline text-foreground mb-4">{t("nav.installed")}</h1>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <InstalledTabButton
                active={activeTab === "skills"}
                onClick={() => {
                  setActiveTab("skills");
                  setSelectedRepository("all");
                  setSearchQuery("");
                }}
                label={t("installed.tabs.skills", { count: tabCounts.skills })}
              />
              <InstalledTabButton
                active={activeTab === "plugins"}
                onClick={() => {
                  setActiveTab("plugins");
                  setSelectedRepository("all");
                  setSearchQuery("");
                }}
                label={t("installed.tabs.plugins", { count: tabCounts.plugins })}
              />
              <InstalledTabButton
                active={activeTab === "marketplaces"}
                onClick={() => {
                  setActiveTab("marketplaces");
                  setSelectedRepository("all");
                  setSearchQuery("");
                }}
                label={t("installed.tabs.marketplaces", { count: tabCounts.marketplaces })}
              />
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={
                    activeTab === "skills"
                      ? t("skills.installedPage.search")
                      : activeTab === "plugins"
                        ? t("plugins.search")
                        : t("installed.marketplaces.search")
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="apple-input w-full h-10 pl-11 pr-4"
                />
              </div>

              {activeTab !== "marketplaces" && (
                <CyberSelect
                  value={selectedRepository}
                  onChange={setSelectedRepository}
                  options={repositoryOptions}
                  className="min-w-[200px]"
                />
              )}

              {activeTab === "skills" && (
                <button
                  onClick={checkUpdatesWithRefresh}
                  disabled={isScanning || isCheckingUpdates}
                  className="apple-button-primary h-10 px-5 flex items-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("skills.installedPage.scanning")}
                    </>
                  ) : isCheckingUpdates ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("skills.installedPage.checkingUpdates")}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {t("skills.installedPage.checkUpdates")}
                    </>
                  )}
                </button>
              )}
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">{t("skills.loading")}</p>
            </div>
          ) : activeTab === "skills" && filteredSkills.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-fr">
              {filteredSkills.map((skill, index) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  index={index}
                  onUninstall={() => {
                    setUninstallingSkillId(skill.id);
                    uninstallMutation.mutate(skill.id, {
                      onSuccess: () => {
                        setUninstallingSkillId(null);
                        appToast.success(t("skills.toast.uninstalled"));
                      },
                      onError: (error: any) => {
                        setUninstallingSkillId(null);
                        appToast.error(
                          `${t("skills.toast.uninstallFailed")}: ${error.message || error}`
                        );
                      },
                    });
                  }}
                  onUninstallPath={(path: string) => {
                    uninstallPathMutation.mutate(
                      { skillId: skill.id, path },
                      {
                        onSuccess: () => appToast.success(t("skills.toast.uninstalled")),
                        onError: (error: any) =>
                          appToast.error(
                            `${t("skills.toast.uninstallFailed")}: ${error.message || error}`
                          ),
                      }
                    );
                  }}
                  onUpdate={async () => {
                    try {
                      setPreparingUpdateSkillId(skill.id);
                      const [report, conflicts] = await api.prepareSkillUpdate(
                        skill.id,
                        i18n.language
                      );
                      setPreparingUpdateSkillId(null);
                      setPendingUpdate({ skill, report, conflicts });
                    } catch (error: any) {
                      setPreparingUpdateSkillId(null);
                      appToast.error(
                        `${t("skills.toast.updateFailed")}: ${error.message || error}`
                      );
                    }
                  }}
                  hasUpdate={availableUpdates.has(skill.id)}
                  isUninstalling={uninstallingSkillId === skill.id}
                  isPreparingUpdate={preparingUpdateSkillId === skill.id}
                  isApplyingUpdate={confirmingUpdateSkillId === skill.id}
                  isAnyOperationPending={
                    uninstallMutation.isPending ||
                    uninstallPathMutation.isPending ||
                    preparingUpdateSkillId !== null ||
                    confirmingUpdateSkillId !== null ||
                    uninstallingPluginId !== null
                  }
                  t={t}
                />
              ))}
            </div>
          ) : activeTab === "plugins" && filteredPlugins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-fr">
              {filteredPlugins.map((plugin) => (
                <InstalledPluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isUninstalling={uninstallingPluginId === plugin.id}
                  isAnyOperationPending={
                    uninstallMutation.isPending ||
                    uninstallPathMutation.isPending ||
                    preparingUpdateSkillId !== null ||
                    confirmingUpdateSkillId !== null ||
                    uninstallingPluginId !== null ||
                    removingMarketplaceName !== null
                  }
                  onUninstall={async () => {
                    try {
                      setUninstallingPluginId(plugin.id);
                      const result = await uninstallPluginMutation.mutateAsync(plugin.id);
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
              ))}
            </div>
          ) : activeTab === "marketplaces" && filteredMarketplaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-fr">
              {filteredMarketplaces.map((marketplace) => (
                <InstalledMarketplaceCard
                  key={marketplace.name}
                  marketplaceName={marketplace.name}
                  marketplaceRepo={marketplace.repoUrl}
                  installedCount={marketplace.installedCount}
                  totalCount={marketplace.totalCount}
                  isRemoving={removingMarketplaceName === marketplace.name}
                  isAnyOperationPending={
                    uninstallingPluginId !== null ||
                    uninstallMutation.isPending ||
                    uninstallPathMutation.isPending ||
                    removingMarketplaceName !== null
                  }
                  onRemove={() => {
                    const installedPluginNames = marketplace.plugins
                      .filter((p) => p.installed)
                      .map((p) => p.name)
                      .sort((a, b) => a.localeCompare(b));
                    setPendingMarketplaceRemove({
                      marketplaceName: marketplace.name,
                      marketplaceRepo: marketplace.repoUrl,
                      installedPluginNames,
                    });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 apple-card">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-5">
                {searchQuery || (activeTab !== "marketplaces" && selectedRepository !== "all") ? (
                  <SearchX className="w-10 h-10 text-muted-foreground" />
                ) : (
                  <Package className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery || (activeTab !== "marketplaces" && selectedRepository !== "all")
                  ? t("installed.empty.noResults", { query: searchQuery })
                  : activeTab === "skills"
                    ? t("skills.installedPage.empty")
                    : activeTab === "plugins"
                      ? t("installed.plugins.empty")
                      : t("installed.marketplaces.empty")}
              </p>
              {(searchQuery || (activeTab !== "marketplaces" && selectedRepository !== "all")) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRepository("all");
                  }}
                  className="mt-5 apple-button-secondary"
                >
                  {t("installed.empty.clearFilters")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <UpdateConfirmDialog
        open={pendingUpdate !== null}
        onClose={async () => {
          if (confirmingUpdateSkillId) return;
          if (pendingUpdate) {
            try {
              await api.cancelSkillUpdate(pendingUpdate.skill.id);
            } catch (error: any) {
              console.error("[ERROR] 取消更新失败:", error);
            }
          }
          setPendingUpdate(null);
        }}
        onConfirm={async (forceOverwrite: boolean) => {
          if (pendingUpdate) {
            try {
              setConfirmingUpdateSkillId(pendingUpdate.skill.id);
              await api.confirmSkillUpdate(pendingUpdate.skill.id, forceOverwrite);
              await queryClient.refetchQueries({ queryKey: ["skills"] });
              await queryClient.refetchQueries({ queryKey: ["skills", "installed"] });
              await queryClient.refetchQueries({ queryKey: ["scanResults"] });
              setAvailableUpdates((prev) => {
                const newMap = new Map(prev);
                newMap.delete(pendingUpdate.skill.id);
                return newMap;
              });
              appToast.success(t("skills.toast.updateSuccess"));
            } catch (error: any) {
              appToast.error(`${t("skills.toast.updateFailed")}: ${error.message || error}`);
            } finally {
              setConfirmingUpdateSkillId(null);
            }
          }
          setPendingUpdate(null);
        }}
        isConfirming={pendingUpdate ? confirmingUpdateSkillId === pendingUpdate.skill.id : false}
        report={pendingUpdate?.report || null}
        conflicts={pendingUpdate?.conflicts || []}
        skillName={pendingUpdate?.skill.name || ""}
      />

      <AlertDialog
        open={pendingMarketplaceRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMarketplaceRemove(null);
        }}
      >
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("plugins.confirmRemoveTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div>
                  {t("plugins.confirmRemoveMessage", {
                    name: pendingMarketplaceRemove?.marketplaceName || "",
                    count: pendingMarketplaceRemove?.installedPluginNames.length || 0,
                  })}
                </div>

                {(pendingMarketplaceRemove?.installedPluginNames.length || 0) > 0 && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                    <div className="text-sm font-medium mb-2">
                      {t("installed.marketplaces.dependentPlugins")}
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 max-h-52 overflow-y-auto">
                      {pendingMarketplaceRemove?.installedPluginNames.slice(0, 30).map((name) => (
                        <li key={name}>- {name}</li>
                      ))}
                      {(pendingMarketplaceRemove?.installedPluginNames.length || 0) > 30 && (
                        <li className="text-xs">
                          {t("installed.marketplaces.andMore", {
                            count:
                              (pendingMarketplaceRemove?.installedPluginNames.length || 0) - 30,
                          })}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMarketplaceName !== null}>
              {t("skills.cancel")}
            </AlertDialogCancel>
            <button
              onClick={async () => {
                if (!pendingMarketplaceRemove) return;
                const { marketplaceName, marketplaceRepo } = pendingMarketplaceRemove;
                setRemovingMarketplaceName(marketplaceName);
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
                  setRemovingMarketplaceName(null);
                }
              }}
              disabled={removingMarketplaceName !== null}
              className="apple-button-primary bg-red-500 hover:bg-red-600 disabled:opacity-50"
            >
              {removingMarketplaceName
                ? t("plugins.removingMarketplace")
                : t("plugins.removeMarketplace")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InstalledTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-4 rounded-lg text-sm transition-colors border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );
}

function InstalledMarketplaceCard({
  marketplaceName,
  marketplaceRepo,
  installedCount,
  totalCount,
  isRemoving,
  isAnyOperationPending,
  onRemove,
}: {
  marketplaceName: string;
  marketplaceRepo: string;
  installedCount: number;
  totalCount: number;
  isRemoving: boolean;
  isAnyOperationPending: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="apple-card p-6 group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground">{marketplaceName}</h3>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium text-purple-600 bg-purple-500/10">
              Marketplace
            </span>
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          <button
            onClick={onRemove}
            disabled={isAnyOperationPending}
            className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isRemoving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("plugins.removingMarketplace")}
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                {t("plugins.removeMarketplace")}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-4">
        <span className="text-blue-500 font-medium">{t("installed.marketplaces.source")}</span>{" "}
        {marketplaceRepo ? (
          <a
            href={marketplaceRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 transition-colors break-all"
          >
            {marketplaceRepo}
          </a>
        ) : (
          <span>{t("skills.empty")}</span>
        )}
      </div>

      <div className="text-sm text-muted-foreground mt-auto">
        <span className="text-blue-500 font-medium">
          {t("installed.marketplaces.pluginsCount")}
        </span>{" "}
        {installedCount} / {totalCount}
      </div>
    </div>
  );
}

interface SkillCardProps {
  skill: Skill;
  index: number;
  onUninstall: () => void;
  onUninstallPath: (path: string) => void;
  onUpdate: () => void;
  hasUpdate: boolean;
  isUninstalling: boolean;
  isPreparingUpdate: boolean;
  isApplyingUpdate: boolean;
  isAnyOperationPending: boolean;
  t: (key: string, options?: any) => string;
}

function SkillCard({
  skill,
  onUninstall,
  onUninstallPath,
  onUpdate,
  hasUpdate,
  isUninstalling,
  isPreparingUpdate,
  isApplyingUpdate,
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
    <div className="apple-card p-6 group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground">{skill.name}</h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                skill.repository_owner === "local"
                  ? "text-muted-foreground bg-secondary"
                  : "text-blue-600 bg-blue-500/10"
              }`}
            >
              {formatRepositoryTag(skill)}
            </span>
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          {hasUpdate && !skill.repository_owner?.includes("local") && (
            <button
              onClick={onUpdate}
              disabled={isAnyOperationPending}
              className="apple-button-primary h-8 px-3 text-xs flex items-center gap-1.5"
            >
              {isPreparingUpdate || isApplyingUpdate ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {isApplyingUpdate
                    ? t("skills.installedPage.applyingUpdate")
                    : t("skills.installedPage.securityChecking")}
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  {t("skills.update")}
                </>
              )}
            </button>
          )}
          <button
            onClick={onUninstall}
            disabled={isAnyOperationPending}
            className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("skills.uninstalling")}
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                {t("skills.uninstallAll")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description - 自动填充剩余空间 */}
      <p
        ref={descriptionRef}
        title={isDescriptionTruncated && skill.description ? skill.description : undefined}
        className="text-sm text-muted-foreground mb-4 leading-5 h-[6.25rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical]"
      >
        {skill.description || t("skills.noDescription")}
      </p>

      {/* Repository - 固定在底部 */}
      <div className="text-sm text-muted-foreground mb-4">
        <span className="text-blue-500 font-medium">{t("skills.repo")}</span>{" "}
        {skill.repository_url === "local" ? (
          <span>{skill.repository_url}</span>
        ) : (
          <a
            href={skill.repository_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 transition-colors break-all"
          >
            {skill.repository_url}
          </a>
        )}
      </div>

      {/* Installed Paths */}
      {skill.local_paths && skill.local_paths.length > 0 && (
        <div className="pt-4 border-t border-border/60">
          <div className="text-xs font-medium text-blue-500 mb-3">
            {t("skills.installedPaths")} ({skill.local_paths.length})
          </div>
          <div className="space-y-2">
            {skill.local_paths.map((path, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 bg-secondary/50 rounded-xl"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
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
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-muted-foreground truncate" title={path}>
                    {path}
                  </span>
                </div>
                <button
                  onClick={() => onUninstallPath(path)}
                  disabled={isAnyOperationPending}
                  className="text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface InstalledPluginCardProps {
  plugin: Plugin;
  isUninstalling: boolean;
  isAnyOperationPending: boolean;
  onUninstall: () => void;
}

function InstalledPluginCard({
  plugin,
  isUninstalling,
  isAnyOperationPending,
  onUninstall,
}: InstalledPluginCardProps) {
  const { t } = useTranslation();
  const installedAt = plugin.installed_at ? new Date(plugin.installed_at) : null;

  return (
    <div className="apple-card p-6 group flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground">{plugin.name}</h3>
            <span className="text-xs px-2.5 py-1 rounded-full font-medium text-purple-600 bg-purple-500/10">
              {t("plugins.badge")}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                plugin.repository_owner === "local"
                  ? "text-muted-foreground bg-secondary"
                  : "text-blue-600 bg-blue-500/10"
              }`}
            >
              {formatRepositoryTag(plugin)}
            </span>
          </div>
          {plugin.marketplace_name && (
            <div className="text-xs text-muted-foreground">
              {t("plugins.marketplace")}: {plugin.marketplace_name}
            </div>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          <button
            onClick={onUninstall}
            disabled={isAnyOperationPending}
            className="apple-button-destructive h-8 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("plugins.uninstalling")}
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                {t("plugins.uninstall")}
              </>
            )}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4 leading-5 h-[6.25rem] overflow-hidden [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical]">
        {plugin.description || t("plugins.noDescription")}
      </p>

      <div className="text-sm text-muted-foreground mb-4">
        <span className="text-blue-500 font-medium">{t("plugins.repo")}</span>{" "}
        <a
          href={plugin.repository_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 transition-colors break-all"
        >
          {plugin.repository_url}
        </a>
      </div>

      {plugin.version && (
        <div className="text-xs text-muted-foreground mb-3">
          <span className="text-blue-500 font-medium">{t("plugins.version")}</span> {plugin.version}
        </div>
      )}

      {installedAt && (
        <div className="text-xs text-muted-foreground mt-auto">
          {t("skills.installedAt")}: {installedAt.toLocaleString()}
        </div>
      )}
    </div>
  );
}

interface UpdateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (forceOverwrite: boolean) => void;
  isConfirming: boolean;
  report: SecurityReport | null;
  conflicts: string[];
  skillName: string;
}

function UpdateConfirmDialog({
  open,
  onClose,
  onConfirm,
  isConfirming,
  report,
  conflicts,
  skillName,
}: UpdateConfirmDialogProps) {
  const { t } = useTranslation();
  const [forceOverwrite, setForceOverwrite] = useState(false);

  const isMediumRisk = report ? report.score >= 50 && report.score < 70 : false;
  const isHighRisk = report ? report.score < 50 || report.blocked : false;
  const hasConflicts = conflicts.length > 0;

  const issueCounts = useMemo(
    () => (report ? countIssuesBySeverity(report.issues) : { critical: 0, error: 0, warning: 0 }),
    [report]
  );

  if (!report) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-5 h-5 text-destructive" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" />
            )}
            {t("skills.installedPage.updateScanResult")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pb-4">
              <div>
                {t("skills.installedPage.preparingUpdate")}:{" "}
                <span className="font-medium">{skillName}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <span className="text-sm">{t("skills.marketplace.install.securityScore")}:</span>
                <span
                  className={`text-2xl font-semibold ${
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

              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-sm text-primary flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  {t("skills.installedPage.updateTip")}
                </div>
              </div>

              {hasConflicts && (
                <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-warning mb-1">
                        {t("skills.installedPage.conflictDetected")}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {t("skills.installedPage.conflictDescription")}
                      </div>
                      <ul className="space-y-1 text-xs max-h-32 overflow-y-auto">
                        {conflicts.slice(0, 10).map((conflict, idx) => (
                          <li key={idx} className="text-warning">
                            • {conflict}
                          </li>
                        ))}
                        {conflicts.length > 10 && (
                          <li className="text-muted-foreground">
                            ...{" "}
                            {t("skills.installedPage.andMore", { count: conflicts.length - 10 })}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 mt-3 p-2 bg-card rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceOverwrite}
                      onChange={(e) => setForceOverwrite(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{t("skills.installedPage.forceOverwrite")}</span>
                  </label>
                </div>
              )}

              {report.issues.length > 0 && (
                <>
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
                  <div
                    className={`p-3 rounded-lg ${isHighRisk ? "bg-destructive/10" : isMediumRisk ? "bg-warning/10" : "bg-success/10"}`}
                  >
                    <ul className="space-y-1 text-sm max-h-48 overflow-y-auto">
                      {report.issues.slice(0, 5).map((issue, idx) => (
                        <li key={idx} className="text-xs">
                          {issue.file_path && (
                            <span className="text-primary mr-1">[{issue.file_path}]</span>
                          )}
                          {issue.description}
                          {issue.line_number && (
                            <span className="text-muted-foreground ml-2">
                              (行 {issue.line_number})
                            </span>
                          )}
                        </li>
                      ))}
                      {report.issues.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          ...{" "}
                          {t("skills.installedPage.andMore", { count: report.issues.length - 5 })}
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}

              {isHighRisk && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    {report.blocked
                      ? t("skills.marketplace.install.blockedWarning")
                      : t("skills.marketplace.install.highRiskWarning")}
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isConfirming}>
            {t("skills.marketplace.install.cancel")}
          </AlertDialogCancel>
          <button
            onClick={() => onConfirm(forceOverwrite)}
            disabled={isConfirming || report.blocked || (hasConflicts && !forceOverwrite)}
            className="macos-button-primary disabled:opacity-50"
          >
            {isConfirming ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("skills.installedPage.applyingUpdate")}
              </span>
            ) : (
              t("skills.marketplace.install.continue")
            )}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
