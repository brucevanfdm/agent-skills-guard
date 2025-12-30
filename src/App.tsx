import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SkillsPage } from "./components/SkillsPage";
import { RepositoriesPage } from "./components/RepositoriesPage";
import { api } from "./lib/api";
import { Terminal, Database, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

const queryClient = new QueryClient();

function AppContent() {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<"skills" | "repositories">("skills");
  const [localScanMessage, setLocalScanMessage] = useState<string | null>(null);
  const [showScanAnimation, setShowScanAnimation] = useState(false);
  const queryClient = useQueryClient();

  // Scan local skills on app startup
  useEffect(() => {
    const initLocalSkills = async () => {
      setShowScanAnimation(true);
      setLocalScanMessage(t('scan.initializing'));

      await new Promise(resolve => setTimeout(resolve, 800));

      try {
        const skills = await api.scanLocalSkills();
        queryClient.invalidateQueries({ queryKey: ["skills"] });
        if (skills.length > 0) {
          setLocalScanMessage(t('scan.complete', { count: skills.length }));
        } else {
          setLocalScanMessage(t('scan.noSkills'));
        }
      } catch (error) {
        console.error("Failed to scan local skills:", error);
        setLocalScanMessage(t('scan.error'));
      } finally {
        setTimeout(() => {
          setShowScanAnimation(false);
          setLocalScanMessage(null);
        }, 2500);
      }
    };
    initLocalSkills();
  }, [queryClient, t]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background relative">
      {/* Matrix background effect */}
      <div className="matrix-bg"></div>

      {/* Scan notification banner */}
      {showScanAnimation && localScanMessage && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-terminal-cyan/20 via-terminal-purple/20 to-terminal-cyan/20 border-b border-terminal-cyan/50 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
        >
          <div className="container mx-auto px-6 py-3 flex items-center gap-3">
            <Zap className="w-4 h-4 text-terminal-cyan animate-pulse" />
            <span className="font-mono text-sm text-terminal-cyan terminal-cursor">
              {localScanMessage}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm z-40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            {/* Left: ASCII Logo and Title */}
            <div className="flex items-center gap-4">
              <div className="text-terminal-cyan font-mono text-2xl leading-none select-none">
                <pre className="text-xs leading-tight">
{`╔═══╗
║ ◎ ║
╚═══╝`}
                </pre>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-terminal-cyan text-glow tracking-wider">
                  {t('header.title')}
                </h1>
                <p className="text-xs text-muted-foreground font-mono mt-1 tracking-wide">
                  <span className="text-terminal-green">&gt;</span> {t('header.subtitle')}
                </p>
              </div>
            </div>

            {/* Right: Language Switcher */}
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-sm z-30">
        <div className="container mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentTab("skills")}
              className={`
                relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
                ${currentTab === "skills"
                  ? "text-terminal-cyan border-b-2 border-terminal-cyan"
                  : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span>{t('nav.skills')}</span>
                {currentTab === "skills" && (
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
                <Database className="w-4 h-4" />
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
            {currentTab === "skills" && <SkillsPage />}
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
            <span className="text-terminal-cyan">{t('footer.version')}0.1.0</span>
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
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
