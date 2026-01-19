import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function usePlugins() {
  return useQuery({
    queryKey: ["plugins"],
    queryFn: () => api.getPlugins(),
  });
}
