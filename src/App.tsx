import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { InstalledSkillsPage } from "./components/InstalledSkillsPage";
import { MarketplacePage } from "./components/MarketplacePage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { OverviewPage } from "./components/OverviewPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { WindowControls } from "./components/WindowControls";
import { UpdateBadge } from "./components/UpdateBadge";
import { Toaster } from "sonner";
import { getPlatform, type Platform } from "./lib/platform";
import { api } from "./lib/api";

const reactQueryClient = new QueryClient();

type TabType = "overview" | "installed" | "marketplace" | "repositories" | "settings";

function AppContent() {
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState<TabType>("overview");
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);

  // 启动时自动更新精选仓库
  useEffect(() => {
    const updateFeaturedRepos = async () => {
      try {
        const data = await api.refreshFeaturedRepositories();
        queryClient.setQueryData(['featured-repositories'], data);
      } catch (error) {
        console.debug('Failed to auto-update featured repositories:', error);
      }
    };
    updateFeaturedRepos();
  }, [queryClient]);

  // 首次启动时自动扫描未扫描的仓库
  useEffect(() => {
    const autoScanRepositories = async () => {
      try {
        const scannedRepos = await api.autoScanUnscannedRepositories();
        if (scannedRepos.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['skills'] });
          queryClient.invalidateQueries({ queryKey: ['repositories'] });
        }
      } catch (error) {
        console.debug('自动扫描仓库失败:', error);
      }
    };
    const timer = setTimeout(autoScanRepositories, 1000);
    return () => clearTimeout(timer);
  }, [queryClient]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Title Bar */}
      <header
        data-tauri-drag-region
        className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-sidebar border-b border-border"
      >
        {/* macOS: 左侧窗口控件 */}
        {platform === "macos" && (
          <div className="w-[70px]">
            <WindowControls />
          </div>
        )}

        {/* 中间占位 */}
        <div className="flex-1" />

        {/* 右侧：更新徽章 + 语言切换 */}
        <div className="flex items-center gap-2">
          <UpdateBadge />
          <LanguageSwitcher />
          {/* Windows/Linux: 右侧窗口控件 */}
          {platform !== "macos" && platform !== null && <WindowControls />}
        </div>
      </header>

      {/* Main Area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div style={{ animation: "fadeIn 0.3s ease-out" }}>
            {currentTab === "overview" && <OverviewPage />}
            {currentTab === "installed" && <InstalledSkillsPage />}
            {currentTab === "marketplace" && (
              <MarketplacePage onNavigateToRepositories={() => setCurrentTab("repositories")} />
            )}
            {currentTab === "repositories" && <RepositoriesPage />}
            {currentTab === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>
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
          style: { fontFamily: 'inherit', fontSize: '14px' },
          classNames: {
            toast: "!rounded-lg !border !shadow-lg",
            default: "!bg-card !border-border !text-foreground",
            success: "!bg-green-50 !border-green-200 !text-green-800",
            info: "!bg-blue-50 !border-blue-200 !text-blue-800",
            warning: "!bg-orange-50 !border-orange-200 !text-orange-800",
            error: "!bg-red-50 !border-red-200 !text-red-800",
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
