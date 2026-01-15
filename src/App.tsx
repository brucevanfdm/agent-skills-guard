import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { InstalledSkillsPage } from "./components/InstalledSkillsPage";
import { MarketplacePage } from "./components/MarketplacePage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { OverviewPage } from "./components/OverviewPage";
import { SettingsPage } from "./components/SettingsPage";
import { Package, ShoppingCart, Database as DatabaseIcon, LayoutDashboard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { WindowControls } from "./components/WindowControls";
import { UpdateBadge } from "./components/UpdateBadge";
import { Toaster } from "sonner";
import { getPlatform, type Platform } from "./lib/platform";
import { api } from "./lib/api";

const reactQueryClient = new QueryClient();

function AppContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<
    "overview" | "installed" | "marketplace" | "repositories" | "settings"
  >("overview");
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);

  // 启动时自动更新精选仓库（静默，无需提示）
  useEffect(() => {
    const updateFeaturedRepos = async () => {
      try {
        const data = await api.refreshFeaturedRepositories();
        queryClient.setQueryData(['featured-repositories'], data);
      } catch (error) {
        // 静默失败，不显示错误提示
        console.debug('Failed to auto-update featured repositories:', error);
      }
    };

    updateFeaturedRepos();
  }, [queryClient]);

  // 首次启动时自动扫描未扫描的仓库（静默，后台执行）
  useEffect(() => {
    const autoScanRepositories = async () => {
      try {
        console.log('[INFO] 检查是否有未扫描的仓库...');
        const scannedRepos = await api.autoScanUnscannedRepositories();

        if (scannedRepos.length > 0) {
          console.log(`[INFO] 自动扫描完成，已扫描 ${scannedRepos.length} 个仓库`);
          // 刷新技能列表，让技能市场显示最新数据
          queryClient.invalidateQueries({ queryKey: ['skills'] });
          queryClient.invalidateQueries({ queryKey: ['repositories'] });
        } else {
          console.log('[INFO] 没有需要扫描的仓库');
        }
      } catch (error) {
        // 静默失败，不影响应用启动
        console.debug('自动扫描仓库失败:', error);
      }
    };

    // 延迟 1 秒执行，让应用先完成初始化
    const timer = setTimeout(autoScanRepositories, 1000);
    return () => clearTimeout(timer);
  }, [queryClient]);

  // 辅助函数：渲染 Logo 和标题，避免代码重复
  const renderLogoTitle = (isCentered: boolean) => (
    <div
      className={`flex items-center gap-3 ${isCentered ? "absolute left-1/2 -translate-x-1/2" : ""}`}
    >
      <div className="text-terminal-cyan font-mono leading-none select-none pointer-events-none">
        <pre
          className="text-[10px] leading-[1.2] tracking-tight"
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {`╔═══╗
║ ◎ ║
╚═══╝`}
        </pre>
      </div>

      <div className="pointer-events-none">
        <h1
          className={`font-bold text-terminal-cyan tracking-wider ${isCentered ? "text-lg" : "text-xl"}`}
        >
          {t("header.title")}
        </h1>
        {/* <p className="text-xs text-muted-foreground font-mono mt-1 tracking-wide">
          <span className="text-terminal-green">&gt;</span> {t('header.subtitle')}
        </p> */}
      </div>
    </div>
  );

  // Removed automatic local skills scan on startup - security dashboard now handles scanning

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background relative">
      {/* Matrix background effect */}
      <div className="matrix-bg"></div>

      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur-sm shadow-lg z-40">
        <div data-tauri-drag-region className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Mac 布局：左侧控件 + 中间标题 + 右侧语言切换 */}
            {platform === "macos" && (
              <>
                {/* 左侧：窗口控件 */}
                <div className="pointer-events-auto">
                  <WindowControls />
                </div>

                {/* 中间：Logo 和标题 */}
                {renderLogoTitle(true)}

                {/* 右侧：更新徽章 + 语言切换器 */}
                <div className="flex items-center gap-3 pointer-events-auto">
                  <UpdateBadge />
                  <LanguageSwitcher />
                </div>
              </>
            )}

            {/* Windows/Linux 布局：左侧标题 + 右侧语言切换和控件 */}
            {platform !== "macos" && platform !== null && (
              <>
                {/* 左侧：Logo 和标题 */}
                {renderLogoTitle(false)}

                {/* 右侧：更新徽章 + 语言切换器和窗口控件 */}
                <div className="flex items-center gap-4">
                  <div className="pointer-events-auto">
                    <UpdateBadge />
                  </div>
                  <div className="pointer-events-auto">
                    <LanguageSwitcher />
                  </div>
                  <div className="pointer-events-auto">
                    <WindowControls />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-sm z-30">
        <div className="w-full px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentTab("overview")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${
                  currentTab === "overview"
                    ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>{t("nav.overview")}</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("installed")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${
                  currentTab === "installed"
                    ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{t("nav.installed")}</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("marketplace")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${
                  currentTab === "marketplace"
                    ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span>{t("nav.marketplace")}</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("repositories")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${
                  currentTab === "repositories"
                    ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <DatabaseIcon className="w-4 h-4" />
                <span>{t("nav.repositories")}</span>
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("settings")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${
                  currentTab === "settings"
                    ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                    : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>{t("nav.settings")}</span>
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content - Scrollable Area */}
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="w-full px-6 py-6">
          <div
            style={{
              animation: "fadeIn 0.4s ease-out",
            }}
          >
            {currentTab === "overview" && <OverviewPage />}
            {currentTab === "installed" && <InstalledSkillsPage />}
            {currentTab === "marketplace" && (
              <MarketplacePage
                onNavigateToRepositories={() => setCurrentTab("repositories")}
              />
            )}
            {currentTab === "repositories" && <RepositoriesPage />}
            {currentTab === "settings" && <SettingsPage />}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={reactQueryClient}>
      <AppContent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: 'inherit',
            fontSize: '14px',
          },
          classNames: {
            toast: "!border-2 backdrop-blur-[8px]",
            default:
              "!bg-[rgba(6,182,212,0.1)] !border-[rgb(6,182,212)] !text-[rgb(94,234,212)] !shadow-[0_0_30px_rgba(6,182,212,0.3)]",
            success:
              "!bg-[rgba(6,182,212,0.1)] !border-[rgb(6,182,212)] !text-[rgb(94,234,212)] !shadow-[0_0_30px_rgba(6,182,212,0.3)]",
            info:
              "!bg-[rgba(6,182,212,0.1)] !border-[rgb(6,182,212)] !text-[rgb(94,234,212)] !shadow-[0_0_30px_rgba(6,182,212,0.3)]",
            loading:
              "!bg-[rgba(6,182,212,0.1)] !border-[rgb(6,182,212)] !text-[rgb(94,234,212)] !shadow-[0_0_30px_rgba(6,182,212,0.3)]",
            warning:
              "!bg-[rgba(234,179,8,0.12)] !border-[rgb(234,179,8)] !text-[rgb(253,224,71)] !shadow-[0_0_30px_rgba(234,179,8,0.25)]",
            error:
              "!bg-[rgba(239,68,68,0.1)] !border-[rgb(239,68,68)] !text-[rgb(252,165,165)] !shadow-[0_0_30px_rgba(239,68,68,0.3)]",
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
