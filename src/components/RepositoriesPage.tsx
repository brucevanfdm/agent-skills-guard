import { useState } from "react";
import {
  useRepositories,
  useAddRepository,
  useDeleteRepository,
  useScanRepository,
} from "../hooks/useRepositories";
import { Search, Plus, Trash2, GitBranch, Loader2, Database, X, Terminal, RefreshCw, Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateStr: string, t: (key: string, options?: any) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t('repositories.date.today');
  if (days === 1) return t('repositories.date.yesterday');
  if (days < 7) return t('repositories.date.daysAgo', { days });

  return date.toLocaleDateString();
}

export function RepositoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: repositories, isLoading } = useRepositories();
  const addMutation = useAddRepository();
  const deleteMutation = useDeleteRepository();
  const scanMutation = useScanRepository();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);

  // 缓存统计查询
  const { data: cacheStats } = useQuery({
    queryKey: ['cache-stats'],
    queryFn: api.getCacheStats,
    refetchInterval: 30000, // 每30秒刷新
  });

  // 清理缓存mutation
  const clearCacheMutation = useMutation({
    mutationFn: api.clearRepositoryCache,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      showToast(t('repositories.cache.cleared'));
    },
    onError: (error: any) => {
      showToast(t('repositories.cache.clearFailed', { error: error.message || error }));
    },
  });

  // 刷新缓存mutation
  const refreshCacheMutation = useMutation({
    mutationFn: api.refreshRepositoryCache,
    onSuccess: (skills) => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      showToast(t('repositories.cache.refreshed', { count: skills.length }));
    },
    onError: (error: any) => {
      showToast(t('repositories.cache.refreshFailed', { error: error.message || error }));
    },
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 添加从 GitHub URL 提取用户名的函数
  const extractRepoNameFromUrl = (url: string): string => {
    try {
      // 支持多种 GitHub URL 格式
      // https://github.com/owner/repo
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      const match = url.match(/github\.com[:/]([^/]+)\//);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    } catch {
      return "";
    }
  };

  // 当 URL 变化时自动提取仓库名称（仅当名称为空时）
  const handleUrlChange = (url: string) => {
    setNewRepoUrl(url);

    // 只在名称为空时自动填充
    if (!newRepoName) {
      const extracted = extractRepoNameFromUrl(url);
      if (extracted) {
        setNewRepoName(extracted);
      }
    }
  };

  const handleAddRepository = () => {
    if (newRepoUrl && newRepoName) {
      addMutation.mutate(
        { url: newRepoUrl, name: newRepoName },
        {
          onSuccess: () => {
            setNewRepoUrl("");
            setNewRepoName("");
            setShowAddForm(false);
            showToast(t('repositories.toast.added'));
          },
          onError: (error: any) => {
            showToast(`${t('repositories.toast.error')}${error.message || error}`);
          },
        }
      );
    }
  };

  const handleClearCache = (repoId: string) => {
    clearCacheMutation.mutate(repoId);
  };

  const handleRefreshCache = (repoId: string) => {
    refreshCacheMutation.mutate(repoId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-terminal-cyan" />
          <h2 className="text-xl font-bold text-terminal-cyan tracking-wider uppercase">
            {t('repositories.title')}
          </h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="neon-button inline-flex items-center gap-2"
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" />
              {t('repositories.cancel')}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {t('repositories.addRepo')}
            </>
          )}
        </button>
      </div>

      {/* Cache Statistics */}
      {cacheStats && (
        <div
          className="cyber-card p-6 border-terminal-purple bg-gradient-to-br from-card via-muted to-card"
          style={{
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(168, 85, 247, 0.1)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-terminal-purple" />
            <h3 className="font-bold text-terminal-purple tracking-wider uppercase">
              {t('repositories.cache.stats')}
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="cyber-card p-4 bg-background/40 border-terminal-cyan/30 hover:border-terminal-cyan hover:shadow-[0_0_15px_rgba(94,234,212,0.2)] transition-all duration-300">
              <div className="text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider flex items-center gap-1">
                <span className="text-terminal-cyan">▸</span>
                {t('repositories.cache.totalRepos')}
              </div>
              <div className="text-3xl font-bold text-terminal-cyan tabular-nums">
                {cacheStats.totalRepositories}
              </div>
            </div>

            <div className="cyber-card p-4 bg-background/40 border-terminal-green/30 hover:border-terminal-green hover:shadow-[0_0_15px_rgba(74,222,128,0.2)] transition-all duration-300">
              <div className="text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider flex items-center gap-1">
                <span className="text-terminal-cyan">▸</span>
                {t('repositories.cache.cached')}
              </div>
              <div className="text-3xl font-bold text-terminal-green tabular-nums">
                {cacheStats.cachedRepositories}
              </div>
            </div>

            <div className="cyber-card p-4 bg-background/40 border-terminal-purple/30 hover:border-terminal-purple hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all duration-300">
              <div className="text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider flex items-center gap-1">
                <span className="text-terminal-cyan">▸</span>
                {t('repositories.cache.size')}
              </div>
              <div className="text-3xl font-bold text-terminal-purple tabular-nums">
                {formatBytes(cacheStats.totalSizeBytes)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Repository Form */}
      {showAddForm && (
        <div
          className="cyber-card p-6 border-terminal-cyan"
          style={{
            animation: 'fadeIn 0.3s ease-out',
            boxShadow: '0 0 20px rgba(94, 234, 212, 0.15)'
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-terminal-cyan" />
            <h3 className="font-bold text-terminal-cyan tracking-wider uppercase">
              {t('repositories.newRepository')}
            </h3>
          </div>

          <div className="space-y-4">
            {/* 先输入 GitHub URL */}
            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                {t('repositories.githubUrl')}
              </label>
              <input
                type="text"
                value={newRepoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="terminal-input font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {t('repositories.urlHint')}
              </p>
            </div>

            {/* 然后显示仓库名称（自动提取，支持手动修改） */}
            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                {t('repositories.repoName')}
              </label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="owner"
                className="terminal-input font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {t('repositories.nameHint')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddRepository}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed flex-1 inline-flex items-center justify-center gap-2"
              disabled={!newRepoUrl || !newRepoName || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('repositories.adding')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('repositories.confirmAdd')}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewRepoUrl("");
                setNewRepoName("");
              }}
              className="px-4 py-2 rounded font-mono text-xs border border-muted-foreground text-muted-foreground hover:border-terminal-purple hover:text-terminal-purple transition-all duration-200"
              disabled={addMutation.isPending}
            >
              {t('repositories.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-6 py-4 rounded-lg bg-terminal-cyan/10 border-2 border-terminal-cyan backdrop-blur-sm shadow-lg z-50 font-mono text-sm text-terminal-cyan"
          style={{
            animation: 'slideInLeft 0.3s ease-out',
            boxShadow: '0 0 30px rgba(94, 234, 212, 0.3)'
          }}
        >
          <span className="text-terminal-green mr-2">❯</span>
          {toast}
        </div>
      )}

      {/* Repository List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-terminal-cyan animate-spin mb-4" />
          <p className="font-mono text-sm text-terminal-cyan uppercase tracking-wider">
            {t('repositories.loading')}
          </p>
        </div>
      ) : repositories && repositories.length > 0 ? (
        <div className="grid gap-4">
          {repositories.map((repo, index) => (
            <div
              key={repo.id}
              className="cyber-card p-5 group"
              style={{
                animation: 'fadeIn 0.4s ease-out',
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'backwards'
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Repository Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <GitBranch className="w-5 h-5 text-terminal-cyan" />
                    <h3 className="font-bold text-lg text-foreground tracking-wide">
                      {repo.name}
                    </h3>
                    {repo.enabled && (
                      <span className="status-indicator text-terminal-green border-terminal-green/30 bg-terminal-green/10">
                        {t('repositories.enabled')}
                      </span>
                    )}
                  </div>

                  {/* Repository URL */}
                  <div className="font-mono text-xs text-muted-foreground mb-2 pl-8">
                    <span className="text-terminal-green">{t('repositories.url')}</span>{" "}
                    <span className="text-terminal-cyan">{repo.url}</span>
                  </div>

                  {/* Description */}
                  {repo.description && (
                    <p className="text-sm text-muted-foreground pl-8 mb-2">
                      {repo.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-6 pl-8 text-xs font-mono">
                    {repo.last_scanned && (
                      <div className="text-muted-foreground">
                        <span className="text-terminal-purple">{t('repositories.lastScan')}</span>{" "}
                        {new Date(repo.last_scanned).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}

                    {/* Cache Status */}
                    <div className="text-muted-foreground">
                      {repo.cache_path ? (
                        <span className="status-indicator text-terminal-green border-terminal-green/40 bg-terminal-green/15 hover:bg-terminal-green/25 transition-colors duration-200">
                          {t('repositories.cache.statusCached')} {repo.cached_at && `· ${formatDate(repo.cached_at, t)}`}
                        </span>
                      ) : (
                        <span className="status-indicator text-muted-foreground border-border bg-background/50">
                          {t('repositories.cache.statusUncached')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setScanningRepoId(repo.id);
                      scanMutation.mutate(repo.id, {
                        onSuccess: (skills) => {
                          setScanningRepoId(null);
                          queryClient.invalidateQueries({ queryKey: ['repositories'] });
                          queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
                          showToast(t('repositories.toast.foundSkills', { count: skills.length }));
                        },
                        onError: (error: any) => {
                          setScanningRepoId(null);
                          showToast(`${t('repositories.toast.scanError')}${error.message || error}`);
                        },
                      });
                    }}
                    disabled={scanMutation.isPending || deleteMutation.isPending}
                    className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-xs"
                  >
                    {scanningRepoId === repo.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('repositories.scanning')}
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        {t('repositories.scan')}
                      </>
                    )}
                  </button>

                  {/* Cache Management Buttons */}
                  {repo.cache_path && (
                    <>
                      <button
                        onClick={() => handleRefreshCache(repo.id)}
                        disabled={refreshCacheMutation.isPending || clearCacheMutation.isPending}
                        title={t('repositories.cache.refreshTooltip')}
                        className="px-3 py-2 rounded font-mono text-xs border border-terminal-purple text-terminal-purple hover:bg-terminal-purple hover:text-background hover:shadow-[0_0_10px_rgba(168,85,247,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {refreshCacheMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('repositories.cache.refreshing')}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            {t('repositories.cache.refresh')}
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleClearCache(repo.id)}
                        disabled={refreshCacheMutation.isPending || clearCacheMutation.isPending}
                        title={t('repositories.cache.clearTooltip')}
                        className="px-3 py-2 rounded font-mono text-xs border-2 border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-background hover:shadow-[0_0_10px_rgba(239,68,68,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {clearCacheMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash className="w-4 h-4" />
                            {t('repositories.cache.clear')}
                          </>
                        )}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setDeletingRepoId(repo.id);
                      deleteMutation.mutate(repo.id, {
                        onSuccess: () => {
                          setDeletingRepoId(null);
                        },
                        onError: () => {
                          setDeletingRepoId(null);
                        },
                      });
                    }}
                    disabled={scanMutation.isPending || deleteMutation.isPending}
                    className="px-3 py-2 rounded font-mono text-xs border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingRepoId === repo.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="cyber-card p-12 text-center border-dashed"
          style={{ animation: 'fadeIn 0.5s ease-out' }}
        >
          <Database className="w-16 h-16 text-terminal-cyan/30 mx-auto mb-4" />
          <p className="text-lg font-mono text-terminal-cyan mb-2 uppercase tracking-wider">
            <span className="text-terminal-green">❯</span> {t('repositories.noReposFound')}
          </p>
          <p className="text-sm text-muted-foreground font-mono">
            {t('repositories.clickAddRepo')}
          </p>
        </div>
      )}
    </div>
  );
}
