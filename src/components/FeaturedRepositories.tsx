import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Loader2,
  Star,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { appToast } from "@/lib/toast";

interface FeaturedRepositoriesProps {
  onAdd: (url: string, name: string) => void;
  isAdding: boolean;
  addingUrl?: string | null;
  variant?: "page" | "sidebar";
  layout?: "collapsible" | "expanded";
  showHeader?: boolean;
  categoryIds?: string[];
  defaultExpandedCategories?: string[];
}

export function FeaturedRepositories({
  onAdd,
  isAdding,
  addingUrl,
  variant = "page",
  layout = "collapsible",
  showHeader = true,
  categoryIds,
  defaultExpandedCategories = ["official", "community"],
}: FeaturedRepositoriesProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(defaultExpandedCategories);

  const { data: config, isLoading } = useQuery({
    queryKey: ["featured-repositories"],
    queryFn: api.getFeaturedRepositories,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

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

  const { data: existingRepos } = useQuery({
    queryKey: ["repositories"],
    queryFn: api.getRepositories,
  });

  const isAdded = (url: string) => {
    return existingRepos?.some((repo) => repo.url === url) || false;
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const getLocalizedText = (text: { en: string; zh: string }) => {
    return i18n.language === "zh" ? text.zh : text.en;
  };

  if (isLoading) {
    return (
      <div className="macos-card p-5 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-muted rounded w-2/3"></div>
      </div>
    );
  }

  if (!config || config.categories.length === 0) {
    return null;
  }

  const categories = (() => {
    if (!categoryIds || categoryIds.length === 0) return config.categories;
    const byId = new Map(config.categories.map((c) => [c.id, c]));
    return categoryIds.map((id) => byId.get(id)).filter(Boolean) as typeof config.categories;
  })();

  if (layout === "expanded") {
    return (
      <div className="grid gap-5">
        {categories.map((category) => (
          <div key={category.id} className="apple-card p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GitBranch className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">{getLocalizedText(category.name)}</h3>
                <p className="text-sm text-muted-foreground">
                  {getLocalizedText(category.description)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {category.repositories.map((repo) => {
                const added = isAdded(repo.url);
                const isAddingThisRepo = addingUrl === repo.url;
                return (
                  <div
                    key={repo.url}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-sm font-medium text-primary">@{repo.name}</h5>
                        {repo.featured && <Star className="w-3 h-3 text-warning fill-warning" />}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical]">
                        {getLocalizedText(repo.description)}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {repo.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => !added && onAdd(repo.url, repo.name)}
                      disabled={added || isAdding}
                      className={`self-end sm:self-auto sm:ml-4 text-xs flex items-center gap-1.5 disabled:opacity-50 ${
                        added
                          ? "px-3 py-1.5 bg-success/10 text-success rounded-lg cursor-default"
                          : "macos-button-primary"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {t("repositories.featured.added")}
                        </>
                      ) : isAddingThisRepo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("repositories.adding")}
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          {t("repositories.featured.add")}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={variant === "sidebar" ? "apple-card p-4" : "macos-card p-5"}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-warning" />
            <h3 className="font-medium">{t("repositories.featured.title")}</h3>
          </div>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title={t("repositories.featured.refresh")}
            className="macos-button-secondary text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {refreshMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t("repositories.featured.refreshing")}
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                {t("repositories.featured.refresh")}
              </>
            )}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {categories.map((category) => {
          const isExpanded = expandedCategories.includes(category.id);

          return (
            <div key={category.id} className="border border-border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <h4 className="font-medium text-sm text-foreground">
                      {getLocalizedText(category.name)}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {getLocalizedText(category.description)}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="p-3 bg-muted/10">
                  <div
                    className={
                      variant === "sidebar"
                        ? "grid grid-cols-1 gap-3"
                        : "grid grid-cols-1 md:grid-cols-2 gap-3"
                    }
                  >
                    {category.repositories.map((repo) => {
                      const added = isAdded(repo.url);
                      const isAddingThisRepo = addingUrl === repo.url;

                      return (
                        <div
                          key={repo.url}
                          className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between bg-card rounded-lg border border-border hover:border-primary/30 transition-all ${
                            variant === "sidebar" ? "p-2.5" : "p-3"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="text-sm font-medium text-primary">@{repo.name}</h5>
                              {repo.featured && (
                                <Star className="w-3 h-3 text-warning fill-warning" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 overflow-hidden [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical]">
                              {getLocalizedText(repo.description)}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {repo.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => !added && onAdd(repo.url, repo.name)}
                            disabled={added || isAdding}
                            className={`self-end sm:self-auto sm:ml-4 text-xs flex items-center gap-1.5 disabled:opacity-50 ${
                              added
                                ? "px-3 py-1.5 bg-success/10 text-success rounded-lg cursor-default"
                                : "macos-button-primary"
                            }`}
                          >
                            {added ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                {t("repositories.featured.added")}
                              </>
                            ) : isAddingThisRepo ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {t("repositories.adding")}
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                {t("repositories.featured.add")}
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
