import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InstalledSkillsPage } from "./components/InstalledSkillsPage";
import { MarketplacePage } from "./components/MarketplacePage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { OverviewPage } from "./components/OverviewPage";
import { Package, ShoppingCart, Database as DatabaseIcon, LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { WindowControls } from "./components/WindowControls";
import { Toaster } from "sonner";
import { getPlatform, type Platform } from "./lib/platform";

// 全局类型声明
declare const __APP_VERSION__: string;

const reactQueryClient = new QueryClient();

function AppContent() {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<
    "overview" | "installed" | "marketplace" | "repositories"
  >("overview");
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);

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

                {/* 右侧：语言切换器 */}
                <div className="pointer-events-auto">
                  <LanguageSwitcher />
                </div>
              </>
            )}

            {/* Windows/Linux 布局：左侧标题 + 右侧语言切换和控件 */}
            {platform !== "macos" && platform !== null && (
              <>
                {/* 左侧：Logo 和标题 */}
                {renderLogoTitle(false)}

                {/* 右侧：语言切换器和窗口控件 */}
                <div className="flex items-center gap-4">
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
                {currentTab === "overview" && <span className="text-terminal-green">●</span>}
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
                {currentTab === "installed" && <span className="text-terminal-green">●</span>}
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
                {currentTab === "marketplace" && <span className="text-terminal-green">●</span>}
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
                {currentTab === "repositories" && <span className="text-terminal-green">●</span>}
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
            {currentTab === "marketplace" && <MarketplacePage />}
            {currentTab === "repositories" && <RepositoriesPage />}
          </div>
        </div>
      </main>

      {/* Footer - Fixed */}
      <footer className="flex-shrink-0 border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="w-full px-6 py-3">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="text-terminal-green">❯</span>
            <span>Agent-Skills-Guard </span>
            <span className="text-terminal-cyan">
              {t("footer.version")}
              {__APP_VERSION__}
            </span>
            <span className="mx-2">•</span>
            <span className="text-terminal-purple">{t("footer.status")}</span>
            <span className="text-terminal-green">{t("footer.operational")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={reactQueryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
