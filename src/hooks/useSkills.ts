import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.getSkills(),
  });
}

export function useInstalledSkills() {
  return useQuery({
    queryKey: ["skills", "installed"],
    queryFn: () => api.getInstalledSkills(),
  });
}

interface InstallSkillVariables {
  skillId: string;
  installPath?: string;
}

export function useInstallSkill() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, InstallSkillVariables>({
    mutationFn: ({ skillId, installPath }) =>
      api.installSkill(skillId, installPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

export function useUninstallSkill() {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: (skillId: string) => api.uninstallSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (skillId: string) => api.deleteSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
