import { useState } from "react";
import {
  useRepositories,
  useAddRepository,
  useDeleteRepository,
  useScanRepository,
} from "../hooks/useRepositories";
import { Search, Plus, Trash2, GitBranch, Loader2, Database, X, Terminal } from "lucide-react";

export function RepositoriesPage() {
  const { data: repositories, isLoading } = useRepositories();
  const addMutation = useAddRepository();
  const deleteMutation = useDeleteRepository();
  const scanMutation = useScanRepository();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
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
            showToast("REPOSITORY_ADDED // SCANNING_SKILLS...");
          },
          onError: (error: any) => {
            showToast(`ERROR: ${error.message || error}`);
          },
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-terminal-cyan" />
          <h2 className="text-xl font-bold text-terminal-cyan tracking-wider uppercase">
            Repository_Config
          </h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="neon-button inline-flex items-center gap-2"
        >
          {showAddForm ? (
            <>
              <X className="w-4 h-4" />
              CANCEL
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              ADD_REPO
            </>
          )}
        </button>
      </div>

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
              NEW_REPOSITORY
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                repo_name:
              </label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="Anthropic Official Skills"
                className="terminal-input font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                github_url:
              </label>
              <input
                type="text"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="terminal-input font-mono"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddRepository}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed flex-1"
              disabled={!newRepoUrl || !newRepoName || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ADDING...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  CONFIRM_ADD
                </>
              )}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded font-mono text-xs border border-muted-foreground text-muted-foreground hover:border-terminal-purple hover:text-terminal-purple transition-all duration-200"
              disabled={addMutation.isPending}
            >
              CANCEL
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
            Loading_Repositories...
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
                        ENABLED
                      </span>
                    )}
                  </div>

                  {/* Repository URL */}
                  <div className="font-mono text-xs text-muted-foreground mb-2 pl-8">
                    <span className="text-terminal-green">URL:</span>{" "}
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
                        <span className="text-terminal-purple">LAST_SCAN:</span>{" "}
                        {new Date(repo.last_scanned).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() =>
                      scanMutation.mutate(repo.id, {
                        onSuccess: (skills) => {
                          showToast(`FOUND_${skills.length}_SKILLS`);
                        },
                        onError: (error: any) => {
                          showToast(`SCAN_ERROR: ${error.message || error}`);
                        },
                      })
                    }
                    disabled={scanMutation.isPending}
                    className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-xs"
                  >
                    {scanMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        SCANNING
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        SCAN
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => deleteMutation.mutate(repo.id)}
                    className="px-3 py-2 rounded font-mono text-xs border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-background transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4" />
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
            <span className="text-terminal-green">❯</span> No_Repositories_Found
          </p>
          <p className="text-sm text-muted-foreground font-mono">
            Click "ADD_REPO" to configure your first repository
          </p>
        </div>
      )}
    </div>
  );
}
