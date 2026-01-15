# macOS 系统设置风格 UI 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Agent Skills Guard 应用从赛博朋克/终端风格重构为 macOS 系统设置浅色风格

**Architecture:** 分层重构 - 先改基础样式系统，再创建新组件，最后重构布局和各页面。保持功能不变，只改视觉呈现。

**Tech Stack:** React, Tailwind CSS, Tauri, TypeScript

---

## Task 1: 重写基础样式系统

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `tailwind.config.js`

**Step 1: 备份并重写 CSS 变量**

将 `src/styles/globals.css` 的 `:root` 部分替换为 macOS 浅色配色：

```css
@layer base {
  :root {
    /* macOS 浅色主题 */
    --background: 0 0% 98%;
    --foreground: 0 0% 13%;

    --card: 0 0% 100%;
    --card-foreground: 0 0% 13%;

    --primary: 211 100% 50%;
    --primary-foreground: 0 0% 100%;

    --secondary: 0 0% 96%;
    --secondary-foreground: 0 0% 13%;

    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 45%;

    --accent: 211 100% 50%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --success: 142 71% 45%;
    --warning: 38 92% 50%;

    --border: 0 0% 90%;
    --input: 0 0% 100%;
    --ring: 211 100% 50%;

    --sidebar-bg: 0 0% 95%;

    --radius: 10px;
    --radius-sm: 6px;
    --radius-lg: 12px;
  }
}
```

**Step 2: 移除赛博朋克效果**

删除以下内容：
- `body::before` 扫描线效果
- `@keyframes blink` 光标闪烁
- `@keyframes glitch` 故障动画
- `@keyframes pulseGlow` 发光脉冲
- `@keyframes matrix-scroll` Matrix 滚动
- `.terminal-cursor`、`.terminal-prompt` 类
- `.ascii-border` 类
- `.neon-button` 类
- `.cyber-card` 类
- `.matrix-bg` 类
- `.glitch-text` 类
- `.cyber-select-*` 类
- `terminal-*` 颜色变量
- `.text-glow`、`.border-glow` 类

**Step 3: 添加 macOS 风格组件类**

```css
@layer components {
  /* macOS 风格卡片 */
  .macos-card {
    @apply bg-card rounded-[10px] border border-border;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }

  .macos-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  }

  /* macOS 风格按钮 */
  .macos-button {
    @apply h-8 px-4 rounded-md text-sm font-medium transition-all duration-150;
  }

  .macos-button-primary {
    @apply macos-button bg-primary text-primary-foreground;
    @apply hover:bg-primary/90;
  }

  .macos-button-secondary {
    @apply macos-button bg-secondary text-secondary-foreground;
    @apply hover:bg-secondary/80;
  }

  .macos-button-destructive {
    @apply macos-button bg-destructive text-destructive-foreground;
    @apply hover:bg-destructive/90;
  }

  .macos-button-ghost {
    @apply macos-button bg-transparent text-foreground;
    @apply hover:bg-secondary;
  }

  /* macOS 风格输入框 */
  .macos-input {
    @apply h-8 px-3 rounded-md text-sm bg-input border border-border;
    @apply focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20;
    @apply transition-all duration-150;
  }

  /* macOS 风格分组标题 */
  .macos-section-title {
    @apply text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1;
  }

  /* 状态标签 */
  .status-safe {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium;
    @apply bg-green-100 text-green-800;
  }

  .status-medium {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium;
    @apply bg-orange-100 text-orange-800;
  }

  .status-critical {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium;
    @apply bg-red-100 text-red-800;
  }

  /* 侧边栏导航项 */
  .sidebar-item {
    @apply flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium;
    @apply text-muted-foreground transition-all duration-150;
    @apply hover:bg-secondary hover:text-foreground;
  }

  .sidebar-item-active {
    @apply bg-primary/10 text-primary;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  /* 保留基础动画 */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
}

@layer utilities {
  .hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
}
```

**Step 4: 更新 tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius)",
        sm: "var(--radius-sm)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        sidebar: "hsl(var(--sidebar-bg))",
      },
    },
  },
  plugins: [],
}
```

**Step 5: 运行开发服务器验证**

Run: `pnpm dev`
Expected: 应用启动，样式可能暂时有些混乱（因为组件还引用旧类名）

**Step 6: Commit**

```bash
git add src/styles/globals.css tailwind.config.js
git commit -m "style: replace cyberpunk theme with macOS light theme"
```

---

## Task 2: 创建 Sidebar 组件

**Files:**
- Create: `src/components/Sidebar.tsx`

**Step 1: 创建侧边栏组件**

```tsx
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Package, ShoppingCart, Database, Settings } from "lucide-react";

type TabType = "overview" | "installed" | "marketplace" | "repositories" | "settings";

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems: { id: TabType; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { id: "overview", icon: LayoutDashboard, labelKey: "nav.overview" },
  { id: "installed", icon: Package, labelKey: "nav.installed" },
  { id: "marketplace", icon: ShoppingCart, labelKey: "nav.marketplace" },
  { id: "repositories", icon: Database, labelKey: "nav.repositories" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar border-r border-border">
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                sidebar-item w-full
                ${isActive ? "sidebar-item-active" : ""}
              `}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add macOS-style Sidebar component"
```

---

## Task 3: 创建 GroupCard 组件

**Files:**
- Create: `src/components/ui/GroupCard.tsx`

**Step 1: 创建分组卡片组件**

```tsx
import { ReactNode } from "react";

interface GroupCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function GroupCard({ title, children, className = "" }: GroupCardProps) {
  return (
    <div className={className}>
      {title && (
        <div className="macos-section-title">{title}</div>
      )}
      <div className="macos-card overflow-hidden">
        {children}
      </div>
    </div>
  );
}

interface GroupCardItemProps {
  children: ReactNode;
  className?: string;
  noBorder?: boolean;
}

export function GroupCardItem({ children, className = "", noBorder = false }: GroupCardItemProps) {
  return (
    <div className={`px-4 py-3 ${noBorder ? "" : "border-b border-border last:border-b-0"} ${className}`}>
      {children}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/GroupCard.tsx
git commit -m "feat: add macOS-style GroupCard component"
```

---

## Task 4: 重构 App.tsx 主布局

**Files:**
- Modify: `src/App.tsx`

**Step 1: 导入新组件并重构布局**

重写 `App.tsx`，将顶部标签导航改为侧边栏布局：

```tsx
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

        {/* 中间标题（可选，macOS 风格通常没有标题） */}
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
```

**Step 2: 运行开发服务器验证布局**

Run: `pnpm dev`
Expected: 看到侧边栏 + 内容区的新布局，侧边栏导航可正常切换

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: convert to sidebar layout for macOS style"
```

---

## Task 5: 更新 WindowControls 组件

**Files:**
- Modify: `src/components/WindowControls.tsx`

**Step 1: 读取当前实现**

先读取文件了解当前实现，然后简化样式。

**Step 2: 更新样式**

移除霓虹发光效果，使用简洁的 macOS 风格：

```tsx
// 保持功能逻辑不变，只更新按钮样式类名
// 移除 terminal-* 颜色引用
// 使用简洁的圆形按钮样式
```

**Step 3: Commit**

```bash
git add src/components/WindowControls.tsx
git commit -m "style: simplify WindowControls for macOS theme"
```

---

## Task 6: 更新 SettingsPage

**Files:**
- Modify: `src/components/SettingsPage.tsx`

**Step 1: 使用 GroupCard 重构设置页**

```tsx
import { useTranslation } from "react-i18next";
import { Settings, Info, Github, RefreshCw, ExternalLink, Package } from "lucide-react";
import { useState } from "react";
import { appToast } from "@/lib/toast";
import { useUpdate } from "../contexts/UpdateContext";
import { GroupCard, GroupCardItem } from "./ui/GroupCard";

declare const __APP_VERSION__: string;

export function SettingsPage() {
  const { t } = useTranslation();
  const updateContext = useUpdate();
  const [updateStatus, setUpdateStatus] = useState<"idle" | "downloading" | "installing">("idle");

  // ... 保持 handleCheckUpdate 和 handleInstallUpdate 逻辑不变 ...

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">
          {t("settings.title")}
        </h1>
      </div>

      {/* Application Info Group */}
      <GroupCard title={t("settings.appInfo.title")}>
        {/* Version */}
        <GroupCardItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="w-4 h-4" />
              <span>{t("settings.appInfo.version")}</span>
            </div>
            <span className="text-sm font-medium">{__APP_VERSION__}</span>
          </div>
        </GroupCardItem>

        {/* GitHub Repository */}
        <GroupCardItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Github className="w-4 h-4" />
              <span>{t("settings.appInfo.repository")}</span>
            </div>
            <a
              href="https://github.com/brucevanfdm/agent-skills-guard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <span>agent-skills-guard</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </GroupCardItem>

        {/* Check for Updates */}
        <GroupCardItem noBorder>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              <span>{t("settings.appInfo.updates")}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* 更新按钮逻辑保持不变，只更新样式类 */}
              <button
                onClick={handleCheckUpdate}
                disabled={updateContext.isChecking || updateStatus !== "idle"}
                className="macos-button-secondary flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${updateContext.isChecking ? "animate-spin" : ""}`} />
                {updateContext.isChecking ? t("update.checking") : t("update.check")}
              </button>
            </div>
          </div>

          {/* Update Info */}
          {updateContext.hasUpdate && updateContext.updateInfo && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-800">
                {t("update.newVersionAvailable")}: {updateContext.updateInfo.availableVersion}
              </div>
              {updateContext.updateInfo.notes && (
                <div className="text-xs text-blue-600 mt-1 max-h-20 overflow-y-auto">
                  {updateContext.updateInfo.notes}
                </div>
              )}
            </div>
          )}
        </GroupCardItem>
      </GroupCard>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SettingsPage.tsx
git commit -m "refactor: SettingsPage with macOS GroupCard style"
```

---

## Task 7: 更新 OverviewPage

**Files:**
- Modify: `src/components/OverviewPage.tsx`
- Modify: `src/components/overview/StatisticsCards.tsx`
- Modify: `src/components/overview/ScanStatusCard.tsx`
- Modify: `src/components/overview/IssuesSummaryCard.tsx`
- Modify: `src/components/overview/IssuesList.tsx`

**Step 1: 更新 OverviewPage 主结构**

- 移除 `cyber-card` 引用，改用 `macos-card`
- 移除 `terminal-*` 颜色引用
- 更新按钮样式为 `macos-button-primary`
- 移除赛博朋克装饰元素

**Step 2: 逐个更新子组件**

每个子组件执行相同的样式替换：
- `terminal-cyan` → `primary`
- `terminal-green` → `success`
- `terminal-red` → `destructive`
- `cyber-card` → `macos-card`
- `neon-button` → `macos-button-*`

**Step 3: Commit**

```bash
git add src/components/OverviewPage.tsx src/components/overview/
git commit -m "refactor: OverviewPage with macOS style components"
```

---

## Task 8: 更新 InstalledSkillsPage

**Files:**
- Modify: `src/components/InstalledSkillsPage.tsx`

**Step 1: 更新页面样式**

- 替换 `cyber-card` → `macos-card`
- 替换 `neon-button` → `macos-button-*`
- 替换 `terminal-*` 颜色 → 新配色
- 更新搜索框样式为 `macos-input`
- 更新状态标签样式

**Step 2: Commit**

```bash
git add src/components/InstalledSkillsPage.tsx
git commit -m "refactor: InstalledSkillsPage with macOS style"
```

---

## Task 9: 更新 MarketplacePage

**Files:**
- Modify: `src/components/MarketplacePage.tsx`

**Step 1: 更新页面样式**

与 InstalledSkillsPage 类似的样式替换。

**Step 2: Commit**

```bash
git add src/components/MarketplacePage.tsx
git commit -m "refactor: MarketplacePage with macOS style"
```

---

## Task 10: 更新 RepositoriesPage

**Files:**
- Modify: `src/components/RepositoriesPage.tsx`

**Step 1: 更新页面样式**

同样的样式替换模式。

**Step 2: Commit**

```bash
git add src/components/RepositoriesPage.tsx
git commit -m "refactor: RepositoriesPage with macOS style"
```

---

## Task 11: 更新 UI 组件

**Files:**
- Modify: `src/components/ui/CyberSelect.tsx` → 重命名或重写为 macOS 风格
- Modify: `src/components/ui/alert-dialog.tsx`
- Modify: `src/components/LanguageSwitcher.tsx`
- Modify: `src/components/UpdateBadge.tsx`

**Step 1: 创建 macOS 风格 Select 组件**

将 CyberSelect 改为简洁的 macOS 风格下拉选择框。

**Step 2: 更新 AlertDialog 样式**

移除霓虹边框，使用简洁阴影。

**Step 3: 更新其他小组件**

LanguageSwitcher、UpdateBadge 等组件的样式更新。

**Step 4: Commit**

```bash
git add src/components/ui/ src/components/LanguageSwitcher.tsx src/components/UpdateBadge.tsx
git commit -m "refactor: update UI components with macOS style"
```

---

## Task 12: 更新弹窗组件

**Files:**
- Modify: `src/components/SecurityDetailDialog.tsx`
- Modify: `src/components/InstallPathSelector.tsx`
- Modify: `src/components/SimplePathSelectionDialog.tsx`

**Step 1: 更新所有弹窗样式**

统一使用 macOS 风格的按钮、输入框、卡片样式。

**Step 2: Commit**

```bash
git add src/components/SecurityDetailDialog.tsx src/components/InstallPathSelector.tsx src/components/SimplePathSelectionDialog.tsx
git commit -m "refactor: update dialog components with macOS style"
```

---

## Task 13: 清理和最终验证

**Step 1: 搜索并清理残留的旧类名引用**

Run: `grep -r "terminal-" src/ --include="*.tsx" --include="*.css"`
Run: `grep -r "cyber-" src/ --include="*.tsx" --include="*.css"`
Run: `grep -r "neon-" src/ --include="*.tsx" --include="*.css"`

确保没有遗漏的旧样式引用。

**Step 2: 全面测试**

Run: `pnpm dev`

验证所有页面：
- [ ] 概览页布局正确
- [ ] 已安装页卡片样式正确
- [ ] 技能市场页搜索和过滤正常
- [ ] 仓库管理页表格样式正确
- [ ] 设置页分组卡片正确
- [ ] 侧边栏导航切换正常
- [ ] 弹窗样式统一
- [ ] Toast 提示样式正确
- [ ] macOS 和 Windows 窗口控件位置正确

**Step 3: 构建测试**

Run: `pnpm build`

确保构建成功无错误。

**Step 4: Final Commit**

```bash
git add -A
git commit -m "chore: cleanup and finalize macOS style migration"
```

---

## 验收标准

1. ✅ 应用使用浅色主题，背景为 #FAFAFA
2. ✅ 侧边栏导航宽度 220px，位于左侧
3. ✅ 所有霓虹发光效果已移除
4. ✅ 卡片使用白色背景和柔和阴影
5. ✅ 按钮使用 macOS 蓝 (#007AFF) 作为主色
6. ✅ 字体使用系统默认字体栈
7. ✅ Windows 和 macOS 窗口控件位置正确
8. ✅ 应用可正常构建
