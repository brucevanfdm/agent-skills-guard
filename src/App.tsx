import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { InstalledSkillsPage } from "./components/InstalledSkillsPage";
import { MarketplacePage } from "./components/MarketplacePage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { OverviewPage } from "./components/OverviewPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
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
        queryClient.setQueryData(["featured-repositories"], data);
      } catch (error) {
        console.debug("Failed to auto-update featured repositories:", error);
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
          queryClient.invalidateQueries({ queryKey: ["skills"] });
          queryClient.invalidateQueries({ queryKey: ["repositories"] });
        }
      } catch (error) {
        console.debug("自动扫描仓库失败:", error);
      }
    };
    const timer = setTimeout(autoScanRepositories, 1000);
    return () => clearTimeout(timer);
  }, [queryClient]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Title Bar - Apple 风格：极简、透明感 */}
      <header
        data-tauri-drag-region
        className="h-12 flex-shrink-0 flex items-center justify-between px-4 bg-sidebar/80 backdrop-blur-xl border-b border-border/50"
      >
        {/* macOS: 左侧窗口控件 */}
        {platform === "macos" && (
          <div className="w-[70px]">
            <WindowControls />
          </div>
        )}

        {/* 中间占位 */}
        <div className="flex-1" />

        {/* 右侧：更新徽章 */}
        <div className="flex items-center gap-3">
          <UpdateBadge />
          {/* Windows/Linux: 右侧窗口控件 */}
          {platform !== "macos" && platform !== null && <WindowControls />}
        </div>
      </header>

      {/* Main Area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />

        {/* Content Area - 更大的内边距，更宽敞的感觉 */}
        <main className="flex-1 overflow-hidden">
          {currentTab === "overview" && (
            <div className="h-full overflow-y-auto">
              <div className="p-8" style={{ animation: "fadeIn 0.4s ease-out" }}>
                <div className="max-w-6xl mx-auto">
                  <OverviewPage />
                </div>
              </div>
            </div>
          )}
          {currentTab === "installed" && (
            <div className="h-full overflow-hidden">
              <InstalledSkillsPage />
            </div>
          )}
          {currentTab === "marketplace" && (
            <div className="h-full overflow-hidden">
              <MarketplacePage onNavigateToRepositories={() => setCurrentTab("repositories")} />
            </div>
          )}
          {currentTab === "repositories" && (
            <div className="h-full overflow-y-auto">
              <div className="p-8" style={{ animation: "fadeIn 0.4s ease-out" }}>
                <div className="max-w-6xl mx-auto">
                  <RepositoriesPage />
                </div>
              </div>
            </div>
          )}
          {currentTab === "settings" && (
            <div className="h-full overflow-y-auto">
              <div className="p-8" style={{ animation: "fadeIn 0.4s ease-out" }}>
                <div className="max-w-6xl mx-auto">
                  <SettingsPage />
                </div>
              </div>
            </div>
          )}
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
          style: { fontFamily: "inherit", fontSize: "14px" },
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
