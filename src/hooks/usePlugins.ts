import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function usePlugins() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: () => api.getPlugins(),
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
    mutationFn: ({ marketplaceName, marketplaceRepo }: { marketplaceName: string; marketplaceRepo: string }) =>
      api.removeMarketplace(marketplaceName, marketplaceRepo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugins"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}
