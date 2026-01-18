import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useAddRepository, useScanRepository } from "../hooks/useRepositories";
import { api } from "../lib/api";
import { FeaturedRepositories } from "./FeaturedRepositories";
import { appToast } from "../lib/toast";

export function FeaturedRepositoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addMutation = useAddRepository();
  const scanMutation = useScanRepository();
  const [addingUrl, setAddingUrl] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshMutation = useMutation({
    mutationFn: api.refreshFeaturedRepositories,
    onSuccess: (data) => {
      queryClient.setQueryData(["featured-repositories"], data);
      appToast.success(t("repositories.featured.refreshed"));
    },
    onError: (error: any) => {
      appToast.error(
        t("repositories.featured.refreshFailed", {
          error: error?.message || String(error),
        })
      );
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline text-foreground">{t("nav.featuredRepositories")}</h1>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 apple-button-primary disabled:opacity-50"
        >
          {refreshMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("repositories.featured.refreshing")}
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {t("repositories.featured.refresh")}
            </>
          )}
        </button>
      </div>

      <FeaturedRepositories
        variant="page"
        layout="expanded"
        showHeader={false}
        categoryIds={["official", "community"]}
        onAdd={async (url, name) => {
          if (isAdding) return;

          setIsAdding(true);
          setAddingUrl(url);

          try {
            const repoId = await addMutation.mutateAsync({ url, name });
            appToast.success(t("repositories.toast.added"));

            try {
              const skills = await scanMutation.mutateAsync(repoId);
              appToast.success(t("repositories.toast.foundSkills", { count: skills.length }));
            } catch (error: any) {
              appToast.error(`${t("repositories.toast.scanError")}${error.message || error}`);
            }
          } catch (error: any) {
            appToast.error(`${t("repositories.toast.error")}${error.message || error}`);
          } finally {
            if (isMountedRef.current) {
              setIsAdding(false);
              setAddingUrl(null);
            }
          }
        }}
        isAdding={isAdding}
        addingUrl={addingUrl}
      />
    </div>
  );
}
