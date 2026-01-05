import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useRepositories() {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepositories(),
  });
}

export function useAddRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, name }: { url: string; name: string }) =>
      api.addRepository(url, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useDeleteRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: string) => api.deleteRepository(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useScanRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: string) => api.scanRepository(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["cache-stats"] });
    },
  });
}
