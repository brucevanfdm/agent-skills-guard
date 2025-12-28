import { useState } from "react";
import {
  useRepositories,
  useAddRepository,
  useDeleteRepository,
  useScanRepository,
} from "../hooks/useRepositories";
import { Search, Plus, Trash2, GitBranch } from "lucide-react";

export function RepositoriesPage() {
  const { data: repositories, isLoading } = useRepositories();
  const addMutation = useAddRepository();
  const deleteMutation = useDeleteRepository();
  const scanMutation = useScanRepository();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoName, setNewRepoName] = useState("");

  const handleAddRepository = () => {
    if (newRepoUrl && newRepoName) {
      addMutation.mutate(
        { url: newRepoUrl, name: newRepoName },
        {
          onSuccess: () => {
            setNewRepoUrl("");
            setNewRepoName("");
            setShowAddForm(false);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">GitHub 仓库配置</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加仓库
        </button>
      </div>

      {showAddForm && (
        <div className="border rounded-lg p-4 bg-card space-y-3">
          <h3 className="font-medium">添加新仓库</h3>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">仓库名称</label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="例: Anthropic Official Skills"
                className="w-full px-3 py-2 border rounded mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">GitHub URL</label>
              <input
                type="text"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 border rounded mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddRepository}
              className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!newRepoUrl || !newRepoName}
            >
              确认添加
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : repositories && repositories.length > 0 ? (
        <div className="grid gap-4">
          {repositories.map((repo) => (
            <div key={repo.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">{repo.name}</h3>
                    {repo.enabled && (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                        已启用
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">
                    {repo.description || repo.url}
                  </p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>URL: {repo.url}</span>
                    {repo.last_scanned && (
                      <span>最后扫描: {new Date(repo.last_scanned).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => scanMutation.mutate(repo.id)}
                    disabled={scanMutation.isPending}
                    className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1"
                  >
                    <Search className="w-4 h-4" />
                    {scanMutation.isPending ? "扫描中..." : "扫描"}
                  </button>

                  <button
                    onClick={() => deleteMutation.mutate(repo.id)}
                    className="px-3 py-1 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg mb-2">暂无仓库</p>
          <p className="text-sm">点击「添加仓库」开始配置</p>
        </div>
      )}
    </div>
  );
}
