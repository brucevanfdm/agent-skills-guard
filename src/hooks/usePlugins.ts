import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import type { Plugin, PluginUninstallResult } from "../types";

export function usePlugins() {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ["plugins", i18n.language],
    queryFn: () => api.getPlugins(i18n.language),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useClaudeMarketplaces() {
  return useQuery({
    queryKey: ["claudeMarketplaces"],
    queryFn: () => api.getClaudeMarketplaces(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}

export function useUninstallPlugin() {
  const queryClient = useQueryClient();

  return useMutation<PluginUninstallResult, Error, string>({
    mutationFn: (pluginId: string) => api.uninstallPlugin(pluginId),
    onSuccess: (result, pluginId) => {
      if (result.success) {
        queryClient.setQueriesData<Plugin[]>({ queryKey: ["plugins"] }, (prev) => {
          if (!prev) return prev;
          return prev.map((plugin) =>
            plugin.id === pluginId
              ? { ...plugin, installed: false, installed_at: undefined, install_status: "uninstalled" }
              : plugin
          );
        });
      }
      queryClient.invalidateQueries({ queryKey: ["plugins"], refetchType: "active" });
    },
  });
}

export function useRemoveMarketplace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      marketplaceName,
      marketplaceRepo,
    }: {
      marketplaceName: string;
      marketplaceRepo: string;
    }) => api.removeMarketplace(marketplaceName, marketplaceRepo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["claudeMarketplaces"] });
    },
  });
}
