import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SkillsPage } from "./components/SkillsPage";
import { RepositoriesPage } from "./components/RepositoriesPage";

const queryClient = new QueryClient();

function App() {
  const [currentTab, setCurrentTab] = useState<"skills" | "repositories">("skills");

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">🛡️ Agent Skills Guard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              安全管理您的 Claude Code Skills
            </p>
          </div>
        </header>

        <nav className="border-b">
          <div className="container mx-auto px-4">
            <div className="flex gap-4">
              <button
                onClick={() => setCurrentTab("skills")}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  currentTab === "skills"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Skills 管理
              </button>
              <button
                onClick={() => setCurrentTab("repositories")}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  currentTab === "repositories"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                仓库配置
              </button>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-6">
          {currentTab === "skills" && <SkillsPage />}
          {currentTab === "repositories" && <RepositoriesPage />}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
