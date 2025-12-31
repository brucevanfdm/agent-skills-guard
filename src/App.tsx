import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InstalledSkillsPage } from "./components/InstalledSkillsPage";
import { MarketplacePage } from "./components/MarketplacePage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { SecurityDashboard } from "./components/SecurityDashboard";
import { Package, ShoppingCart, Database as DatabaseIcon, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { WindowControls } from "./components/WindowControls";
import { Toaster } from "sonner";

// 全局类型声明
declare const __APP_VERSION__: string;

const reactQueryClient = new QueryClient();

function AppContent() {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<"security" | "installed" | "marketplace" | "repositories">("security");

  // Removed automatic local skills scan on startup - security dashboard now handles scanning

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background relative">
      {/* Matrix background effect */}
      <div className="matrix-bg"></div>

      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur-sm shadow-lg z-40">
        <div data-tauri-drag-region className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: ASCII Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="text-terminal-cyan font-mono text-2xl leading-none select-none pointer-events-none">
                <pre className="text-xs leading-tight">
{`╔═══╗
║ ◎ ║
╚═══╝`}
                </pre>
              </div>

              <div className="pointer-events-none">
                <h1 className="text-2xl font-bold text-terminal-cyan text-glow tracking-wider">
                  {t('header.title')}
                </h1>
                <p className="text-xs text-muted-foreground font-mono mt-1 tracking-wide">
                  <span className="text-terminal-green">&gt;</span> {t('header.subtitle')}
                </p>
              </div>
            </div>

            {/* Right: Language Switcher and Window Controls */}
            <div className="flex items-center gap-4">
              <div className="pointer-events-auto">
                <LanguageSwitcher />
              </div>
              <div className="pointer-events-auto">
                <WindowControls />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-sm z-30">
        <div className="container mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentTab("security")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${currentTab === "security"
                  ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>{t('nav.security')}</span>
                {currentTab === "security" && (
                  <span className="text-terminal-green">●</span>
                )}
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("installed")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${currentTab === "installed"
                  ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{t('nav.installed')}</span>
                {currentTab === "installed" && (
                  <span className="text-terminal-green">●</span>
                )}
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("marketplace")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${currentTab === "marketplace"
                  ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span>{t('nav.marketplace')}</span>
                {currentTab === "marketplace" && (
                  <span className="text-terminal-green">●</span>
                )}
              </div>
            </button>

            <button
              onClick={() => setCurrentTab("repositories")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${currentTab === "repositories"
                  ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <DatabaseIcon className="w-4 h-4" />
                <span>{t('nav.repositories')}</span>
                {currentTab === "repositories" && (
                  <span className="text-terminal-green">●</span>
                )}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content - Scrollable Area */}
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="container mx-auto px-6 py-8">
          <div
            style={{
              animation: 'fadeIn 0.4s ease-out'
            }}
          >
            {currentTab === "security" && <SecurityDashboard />}
            {currentTab === "installed" && <InstalledSkillsPage />}
            {currentTab === "marketplace" && <MarketplacePage />}
            {currentTab === "repositories" && <RepositoriesPage />}
          </div>
        </div>
      </main>

      {/* Footer - Fixed */}
      <footer className="flex-shrink-0 border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="text-terminal-green">❯</span>
            <span>agent-skills-guard</span>
            <span className="text-terminal-cyan">{t('footer.version')}{__APP_VERSION__}</span>
            <span className="mx-2">•</span>
            <span className="text-terminal-purple">{t('footer.status')}</span>
            <span className="text-terminal-green">{t('footer.operational')}</span>
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
