import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

export function usePlugins() {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ["plugins", i18n.language],
    queryFn: () => api.getPlugins(i18n.language),
  });
}

export function useClaudeMarketplaces() {
  return useQuery({
    queryKey: ["claudeMarketplaces"],
    queryFn: () => api.getClaudeMarketplaces(),
  });
}

export function useUninstallPlugin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pluginId: string) => api.uninstallPlugin(pluginId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
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
