import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Plus, Check, Loader2, Star, GitBranch, RefreshCw } from "lucide-react";
import { appToast } from "@/lib/toast";

interface FeaturedRepositoriesProps {
  onAdd: (url: string, name: string) => void;
  isAdding: boolean;
}

export function FeaturedRepositories({ onAdd, isAdding }: FeaturedRepositoriesProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["official"]);

  // 获取精选仓库
  const { data: config, isLoading } = useQuery({
    queryKey: ['featured-repositories'],
    queryFn: api.getFeaturedRepositories,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    retry: false, // YAML 文件不存在时不重试
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshFeaturedRepositories,
    onSuccess: (data) => {
      queryClient.setQueryData(['featured-repositories'], data);
      appToast.success(t('repositories.featured.refreshed'));
    },
    onError: (error: any) => {
      appToast.error(
        t('repositories.featured.refreshFailed', {
          error: error?.message || String(error),
        })
      );
    },
  });

  // 获取已添加的仓库列表
  const { data: existingRepos } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.getRepositories,
  });

  // 检查仓库是否已添加
  const isAdded = (url: string) => {
    return existingRepos?.some(repo => repo.url === url) || false;
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getLocalizedText = (text: { en: string; zh: string }) => {
    return i18n.language === 'zh' ? text.zh : text.en;
  };

  if (isLoading) {
    return (
      <div className="cyber-card p-6 border-terminal-cyan animate-pulse">
        <div className="h-6 bg-terminal-cyan/20 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-terminal-cyan/20 rounded w-2/3"></div>
      </div>
    );
  }

  // 优雅降级：如果没有配置或读取失败，不显示该区域
  if (!config || config.categories.length === 0) {
    return null;
  }

  return (
    <div className="cyber-card p-6 border-terminal-cyan bg-gradient-to-br from-card via-muted to-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-terminal-cyan" />
          <h3 className="font-bold text-terminal-cyan tracking-wider uppercase">
            {t('repositories.featured.title')}
          </h3>
        </div>

        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          title={t('repositories.featured.refresh')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs bg-terminal-cyan/10 hover:bg-terminal-cyan/20 text-terminal-cyan border border-terminal-cyan/30 hover:border-terminal-cyan transition-colors duration-200 disabled:opacity-50"
        >
          {refreshMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin will-change-transform transform-gpu" />
              {t('repositories.featured.refreshing')}
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              {t('repositories.featured.refresh')}
            </>
          )}
        </button>
      </div>

      <div className="space-y-4">
        {config.categories.map((category) => {
          const isExpanded = expandedCategories.includes(category.id);

          return (
            <div key={category.id} className="border border-border/30 rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 bg-background/40 hover:bg-background/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-terminal-cyan" />
                  <div className="text-left">
                    <h4 className="font-semibold text-sm text-foreground">
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
                <div className="p-4 bg-background/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.repositories.map((repo) => {
                      const added = isAdded(repo.url);

                      return (
                        <div
                          key={repo.url}
                          className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between p-3 bg-background/40 rounded border border-border/20 hover:border-terminal-cyan/40 transition-all"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-mono text-sm font-semibold text-terminal-cyan">
                                @{repo.name}
                              </h5>
                              {repo.featured && (
                                <Star className="w-3 h-3 text-terminal-yellow fill-terminal-yellow" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {getLocalizedText(repo.description)}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {repo.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 text-xs font-mono bg-terminal-cyan/10 text-terminal-cyan rounded border border-terminal-cyan/30"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => !added && onAdd(repo.url, repo.name)}
                            disabled={added || isAdding}
                            className={`self-end sm:self-auto sm:ml-4 px-3 py-2 rounded font-mono text-xs transition-all flex items-center gap-1 ${
                              added
                                ? 'bg-terminal-green/10 text-terminal-green border border-terminal-green/30 cursor-default'
                                : 'neon-button'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {added ? (
                              <>
                                <Check className="w-4 h-4" />
                                {t('repositories.featured.added')}
                              </>
                            ) : isAdding ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('repositories.adding')}
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                {t('repositories.featured.add')}
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
