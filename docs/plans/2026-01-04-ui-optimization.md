# UI 优化实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 优化技能市场、我的技能、仓库管理和系统概览页面的用户界面，提升用户体验。

**架构：** 对现有 React 组件进行界面优化，包括移除冗余按钮、添加筛选功能、优化表单流程和调整布局。所有更改都是界面层面的修改，不涉及后端逻辑。

**技术栈：** React、TypeScript、Lucide Icons、React-i18next

---

## 任务 1：移除技能卡片的删除按钮

**文件：**
- Modify: `src/components/MarketplacePage.tsx:494-505`
- Modify: `src/components/InstalledSkillsPage.tsx:306-316`

### 步骤 1：修改 MarketplacePage 组件

在 MarketplacePage.tsx 中，移除删除按钮，只保留安装/卸载按钮。

**需要修改的部分：**

```tsx
// 当前代码（第 461-505 行）
        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          {skill.installed ? (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUninstalling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('skills.uninstall')
              )}
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              disabled={isAnyOperationPending}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.installing')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('skills.install')}
                </>
              )}
            </button>
          )}

          <button
            onClick={onDelete}
            disabled={isAnyOperationPending}
            className="px-3 py-2 rounded border border-border bg-card text-muted-foreground hover:border-terminal-red hover:text-terminal-red transition-all duration-200 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
```

**修改为（移除删除按钮，为卸载按钮添加图标）：**

```tsx
        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          {skill.installed ? (
            <button
              onClick={onUninstall}
              disabled={isAnyOperationPending}
              className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isUninstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.uninstalling')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t('skills.uninstall')}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleInstallClick}
              disabled={isAnyOperationPending}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('skills.installing')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('skills.install')}
                </>
              )}
            </button>
          )}
        </div>
```

### 步骤 2：修改 InstalledSkillsPage 组件

在 InstalledSkillsPage.tsx 中，同样移除删除按钮，为卸载按钮添加图标。

**需要修改的部分：**

```tsx
// 当前代码（第 292-317 行）
        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={onUninstall}
            disabled={isAnyOperationPending}
            className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUninstalling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t('skills.uninstall')
            )}
          </button>

          <button
            onClick={onDelete}
            disabled={isAnyOperationPending}
            className="px-3 py-2 rounded border border-border bg-card text-muted-foreground hover:border-terminal-red hover:text-terminal-red transition-all duration-200 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
```

**修改为：**

```tsx
        {/* Action Buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={onUninstall}
            disabled={isAnyOperationPending}
            className="neon-button text-terminal-red border-terminal-red hover:bg-terminal-red disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isUninstalling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.uninstalling')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {t('skills.uninstall')}
              </>
            )}
          </button>
        </div>
```

### 步骤 3：更新组件接口

移除不再需要的 `onDelete`、`isDeleting` 相关的 props 和导入。

**在 MarketplacePage.tsx 中：**

```tsx
// 第 2 行，移除 useDeleteSkill
import { useSkills, useInstallSkill, useUninstallSkill } from "../hooks/useSkills";

// 第 27 行，移除 deleteMutation
const deleteMutation = useDeleteSkill();  // 删除这行

// 第 355-356 行，移除 onDelete 相关 props
interface SkillCardProps {
  skill: Skill;
  index: number;
  onInstall: () => void;
  onUninstall: () => void;
  onDelete: () => void;  // 删除这行
  isInstalling: boolean;
  isUninstalling: boolean;
  isDeleting: boolean;  // 删除这行
  isAnyOperationPending: boolean;
  getSecurityBadge: (score?: number) => React.ReactNode;
  t: (key: string, options?: any) => string;
}

// 在 SkillCard 函数参数中移除（第 365-377 行）
function SkillCard({
  skill,
  index,
  onInstall,
  onUninstall,
  onDelete,  // 删除这行
  isInstalling,
  isUninstalling,
  isDeleting,  // 删除这行
  isAnyOperationPending,
  getSecurityBadge,
  t
}: SkillCardProps) {

// 在 SkillCard 的调用中移除（第 271-285 行）
            <SkillCard
              key={skill.id}
              skill={skill}
              index={index}
              onInstall={...}
              onUninstall={...}
              onDelete={() => {  // 删除整个 onDelete 回调
                deleteMutation.mutate(skill.id, {
                  onSuccess: () => {
                    showToast(t('skills.toast.deleted'));
                  },
                  onError: (error: any) => {
                    showToast(`${t('skills.toast.deleteFailed')}: ${error.message || error}`);
                  },
                });
              }}
              isInstalling={installMutation.isPending && installMutation.variables === skill.id}
              isUninstalling={uninstallMutation.isPending && uninstallMutation.variables === skill.id}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === skill.id}  // 删除这行
              isAnyOperationPending={installMutation.isPending || uninstallMutation.isPending || deleteMutation.isPending}  // 修改为只检查 installMutation 和 uninstallMutation
              getSecurityBadge={getSecurityBadge}
              t={t}
            />
```

**在 InstalledSkillsPage.tsx 中进行类似的清理：**

```tsx
// 第 2 行，移除 useDeleteSkill
import { useInstalledSkills, useUninstallSkill } from "../hooks/useSkills";

// 第 17 行，移除 deleteMutation
const deleteMutation = useDeleteSkill();  // 删除这行

// 第 22 行，移除 deletingSkillId
const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);  // 删除这行

// 第 207-208 行，移除 onDelete 和 isDeleting
interface SkillCardProps {
  skill: Skill;
  index: number;
  onUninstall: () => void;
  onDelete: () => void;  // 删除这行
  isUninstalling: boolean;
  isDeleting: boolean;  // 删除这行
  isAnyOperationPending: boolean;
  getSecurityBadge: (score?: number) => React.ReactNode;
  onNavigateToOverview: () => void;
  t: (key: string, options?: any) => string;
}

// 在 SkillCard 函数参数中移除（第 217-228 行）
function SkillCard({
  skill,
  index,
  onUninstall,
  onDelete,  // 删除这行
  isUninstalling,
  isDeleting,  // 删除这行
  isAnyOperationPending,
  getSecurityBadge,
  onNavigateToOverview,
  t
}: SkillCardProps) {

// 在 SkillCard 的调用中移除（第 144-159 行）
              onDelete={() => {  // 删除整个 onDelete 回调
                setDeletingSkillId(skill.id);
                deleteMutation.mutate(skill.id, {
                  onSuccess: () => {
                    setDeletingSkillId(null);
                    showToast(t('skills.toast.deleted'));
                  },
                  onError: (error: any) => {
                    setDeletingSkillId(null);
                    showToast(`${t('skills.toast.deleteFailed')}: ${error.message || error}`);
                  },
                });
              }}
              isUninstalling={uninstallingSkillId === skill.id}
              isDeleting={deletingSkillId === skill.id}  // 删除这行
              isAnyOperationPending={uninstallMutation.isPending || deleteMutation.isPending}  // 修改为只检查 uninstallMutation
```

---

## 任务 2：在我的技能页面添加筛选和扫描功能

**文件：**
- Modify: `src/components/InstalledSkillsPage.tsx:1-116`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

### 步骤 1：添加必要的导入

在文件顶部添加新的导入：

```tsx
import { useState, useMemo } from "react";
import { useInstalledSkills, useUninstallSkill } from "../hooks/useSkills";
import { Skill } from "../types";
import { Trash2, Loader2, FolderOpen, Package, Search, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";  // 添加 RefreshCw
import { useTranslation } from "react-i18next";
import { openPath } from "@tauri-apps/plugin-opener";
import { formatRepositoryTag } from "../lib/utils";
import { CyberSelect, type CyberSelectOption } from "./ui/CyberSelect";  // 添加这行
import { invoke } from "@tauri-apps/api/core";  // 添加这行
import { useQueryClient, useMutation } from "@tanstack/react-query";  // 添加这行
import { api } from "../lib/api";  // 添加这行
```

### 步骤 2：在组件中添加状态和逻辑

```tsx
export function InstalledSkillsPage({ onNavigateToOverview }: InstalledSkillsPageProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();  // 添加这行
  const { data: installedSkills, isLoading } = useInstalledSkills();
  const uninstallMutation = useUninstallSkill();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepository, setSelectedRepository] = useState("all");  // 添加这行
  const [toast, setToast] = useState<string | null>(null);
  const [uninstallingSkillId, setUninstallingSkillId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);  // 添加这行

  // ... showToast 函数保持不变

  // 添加扫描本地技能的 mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      const localSkills = await api.scanLocalSkills();
      return localSkills;
    },
    onSuccess: (localSkills) => {
      queryClient.invalidateQueries({ queryKey: ["installedSkills"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      showToast(t('skills.installedPage.scanCompleted', { count: localSkills.length }));
    },
    onError: (error: any) => {
      showToast(t('skills.installedPage.scanFailed', { error: error.message }));
    },
    onSettled: () => {
      setIsScanning(false);
    },
  });

  // 提取所有仓库及其技能数量
  const repositories = useMemo(() => {
    if (!installedSkills) return [];
    const ownerMap = new Map<string, number>();

    installedSkills.forEach((skill) => {
      const owner = skill.repository_owner || "unknown";
      ownerMap.set(owner, (ownerMap.get(owner) || 0) + 1);
    });

    const repos = Array.from(ownerMap.entries())
      .map(([owner, count]) => ({
        owner,
        count,
        displayName: owner === "local" ? t('skills.marketplace.localRepo') : `@${owner}`
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return [
      { owner: "all", count: installedSkills.length, displayName: t('skills.marketplace.allRepos') },
      ...repos
    ];
  }, [installedSkills, i18n.language, t]);

  // 转换为 CyberSelect 选项格式
  const repositoryOptions: CyberSelectOption[] = useMemo(() => {
    return repositories.map((repo) => ({
      value: repo.owner,
      label: `${repo.displayName} (${repo.count})`,
    }));
  }, [repositories]);

  // 搜索过滤和排序（更新以支持仓库筛选）
  const filteredSkills = useMemo(() => {
    if (!installedSkills) return [];

    let skills = installedSkills;

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      skills = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description?.toLowerCase().includes(query)
      );
    }

    // 仓库过滤
    if (selectedRepository !== "all") {
      skills = skills.filter(
        (skill) => skill.repository_owner === selectedRepository
      );
    }

    // 按安装时间排序，最近安装的在前
    return [...skills].sort((a, b) => {
      const timeA = a.installed_at ? new Date(a.installed_at).getTime() : 0;
      const timeB = b.installed_at ? new Date(b.installed_at).getTime() : 0;
      return timeB - timeA; // 降序排列
    });
  }, [installedSkills, searchQuery, selectedRepository]);

  // ... getSecurityBadge 函数保持不变
```

### 步骤 3：更新 JSX - 添加筛选和扫描按钮

修改 Header Section 部分：

```tsx
      {/* Header Section */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg text-terminal-cyan tracking-wider flex items-center gap-2">
              <Package className="w-5 h-5" />
              <span>{t('nav.installed')}</span>
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              <span className="text-terminal-green">&gt;</span> {t('skills.installedPage.count', { count: filteredSkills.length })}
            </p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('skills.installedPage.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-terminal-cyan transition-colors"
            />
          </div>

          {/* Repository Filter */}
          <CyberSelect
            value={selectedRepository}
            onChange={setSelectedRepository}
            options={repositoryOptions}
            className="min-w-[200px]"
          />

          {/* Scan Local Skills Button */}
          <button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
            className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('skills.installedPage.scanning')}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {t('skills.installedPage.scanLocal')}
              </>
            )}
          </button>
        </div>
      </div>
```

### 步骤 4：添加翻译键

在 `src/i18n/locales/zh.json` 中添加：

```json
{
  "skills": {
    "installedPage": {
      "scanLocal": "扫描本地",
      "scanning": "扫描中...",
      "scanCompleted": "扫描完成，发现 {{count}} 个技能",
      "scanFailed": "扫描失败：{{error}}"
    }
  }
}
```

在 `src/i18n/locales/en.json` 中添加：

```json
{
  "skills": {
    "installedPage": {
      "scanLocal": "Scan Local",
      "scanning": "Scanning...",
      "scanCompleted": "Scan completed, found {{count}} skills",
      "scanFailed": "Scan failed: {{error}}"
    }
  }
}
```

---

## 任务 3：优化添加仓库流程

**文件：**
- Modify: `src/components/RepositoriesPage.tsx:191-261`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

### 步骤 1：调整状态顺序和提取逻辑

在 RepositoriesPage 组件中，修改添加仓库的逻辑：

```tsx
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);

  // ... 其他代码

  // 添加从 GitHub URL 提取用户名的函数
  const extractRepoNameFromUrl = (url: string): string => {
    try {
      // 支持多种 GitHub URL 格式
      // https://github.com/owner/repo
      // https://github.com/owner/repo.git
      // git@github.com:owner/repo.git
      const match = url.match(/github\.com[:/]([^/]+)\//);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    } catch {
      return "";
    }
  };

  // 当 URL 变化时自动提取仓库名称（仅当名称为空或是之前自动生成的）
  const handleUrlChange = (url: string) => {
    setNewRepoUrl(url);

    // 只在名称为空时自动填充
    if (!newRepoName) {
      const extracted = extractRepoNameFromUrl(url);
      if (extracted) {
        setNewRepoName(extracted);
      }
    }
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
            showToast(t('repositories.toast.added'));
          },
          onError: (error: any) => {
            showToast(`${t('repositories.toast.error')}${error.message || error}`);
          },
        }
      );
    }
  };
```

### 步骤 2：调整表单字段顺序

将表单中的字段顺序调整为先 URL，后名称：

```tsx
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
              {t('repositories.newRepository')}
            </h3>
          </div>

          <div className="space-y-4">
            {/* 先输入 GitHub URL */}
            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                {t('repositories.githubUrl')}
              </label>
              <input
                type="text"
                value={newRepoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="terminal-input font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {t('repositories.urlHint')}
              </p>
            </div>

            {/* 然后显示仓库名称（自动提取，支持手动修改） */}
            <div>
              <label className="block text-xs font-mono text-terminal-green mb-2 uppercase tracking-wider">
                {t('repositories.repoName')}
              </label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="owner"
                className="terminal-input font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {t('repositories.nameHint')}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleAddRepository}
              className="neon-button disabled:opacity-50 disabled:cursor-not-allowed flex-1 inline-flex items-center justify-center gap-2"
              disabled={!newRepoUrl || !newRepoName || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('repositories.adding')}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  {t('repositories.confirmAdd')}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewRepoUrl("");
                setNewRepoName("");
              }}
              className="px-4 py-2 rounded font-mono text-xs border border-muted-foreground text-muted-foreground hover:border-terminal-purple hover:text-terminal-purple transition-all duration-200"
              disabled={addMutation.isPending}
            >
              {t('repositories.cancel')}
            </button>
          </div>
        </div>
      )}
```

### 步骤 3：添加翻译

在 `src/i18n/locales/zh.json` 中添加/更新：

```json
{
  "repositories": {
    "urlHint": "输入完整的 GitHub 仓库链接",
    "nameHint": "自动从 URL 提取，可手动修改"
  }
}
```

在 `src/i18n/locales/en.json` 中添加/更新：

```json
{
  "repositories": {
    "urlHint": "Enter the full GitHub repository URL",
    "nameHint": "Auto-extracted from URL, can be modified"
  }
}
```

---

## 任务 4：调整系统概览页面的扫描按钮位置

**文件：**
- Modify: `src/components/OverviewPage.tsx:229-251`
- Modify: `src/components/overview/ScanStatusCard.tsx:全文`

### 步骤 1：修改 OverviewPage 组件

将扫描按钮从 ScanStatusCard 中移到页面标题旁边：

```tsx
  return (
    <div className="space-y-6">
      {/* 页面标题 - 添加扫描按钮 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-terminal-cyan tracking-wider uppercase">
          {t('overview.title')}
        </h1>

        {/* 一键扫描按钮 */}
        <button
          onClick={() => scanMutation.mutate()}
          disabled={isScanning}
          className="
            relative
            px-6 py-2.5
            bg-terminal-cyan text-background
            font-mono font-medium text-sm uppercase tracking-wider
            rounded
            hover:bg-terminal-cyan/90 hover:shadow-lg hover:shadow-terminal-cyan/30
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            flex items-center gap-2
            overflow-hidden
            group
          "
        >
          {/* 按钮扫描线效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

          {isScanning && <Loader2 className="w-4 h-4 animate-spin" />}
          <span className="relative z-10">
            {isScanning
              ? t('overview.scanStatus.scanning')
              : t('overview.scanStatus.scanAll')
            }
          </span>
        </button>
      </div>

      {/* 第一行：统计卡片 */}
      <StatisticsCards
        installedCount={statistics.installedCount}
        repositoryCount={statistics.repositoryCount}
        scannedCount={statistics.scannedCount}
      />

      {/* 第二行：扫描状态卡片（移除按钮，进度条占满） */}
      <ScanStatusCard
        lastScanTime={lastScanTime}
        scannedCount={statistics.scannedCount}
        totalCount={statistics.installedCount}
        issueCount={issueCount}
        isScanning={isScanning}
      />

      {/* 其余部分保持不变 */}
```

### 步骤 2：修改 ScanStatusCard 组件

移除 `onScan` prop 和按钮，让进度条占据更多空间：

```tsx
interface ScanStatusCardProps {
  lastScanTime: Date | null;
  scannedCount: number;
  totalCount: number;
  issueCount: number;
  isScanning: boolean;
  // 移除 onScan: () => void;
}

export function ScanStatusCard({
  lastScanTime,
  scannedCount,
  totalCount,
  issueCount,
  isScanning,
  // 移除 onScan
}: ScanStatusCardProps) {
  const { t, i18n } = useTranslation();

  const progress = totalCount > 0 ? (scannedCount / totalCount) * 100 : 0;
  const isComplete = scannedCount === totalCount && totalCount > 0;

  // 格式化相对时间
  const formatRelativeTime = (date: Date) => {
    const locale = i18n.language === 'zh' ? zhCN : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:shadow-terminal-cyan/10 hover:border-terminal-cyan/30 transition-all duration-300 relative overflow-hidden">
      {/* 左侧赛博朋克风格竖线 */}
      <div className="absolute top-0 left-0 w-1 h-full bg-terminal-cyan opacity-50"></div>

      {/* 顶部角落装饰 */}
      <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-border/30 rounded-tr-lg"></div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center relative pl-3">
        {/* 左侧：扫描信息 */}
        <div className="flex-shrink-0 min-w-[200px]">
          <div className="text-sm text-muted-foreground mb-2">
            <span className="font-medium uppercase tracking-wide">{t('overview.scanStatus.lastScan')}：</span>
            {lastScanTime ? (
              <span className="text-foreground font-mono">{formatRelativeTime(lastScanTime)}</span>
            ) : (
              <span className="text-terminal-yellow font-mono">{t('overview.scanStatus.never')}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('overview.scanStatus.scanned')}
            <span className="font-mono font-bold text-terminal-cyan mx-1">
              {scannedCount}
            </span>
            {t('overview.scanStatus.of')}
            <span className="font-mono font-bold mx-1">
              {totalCount}
            </span>
            {t('overview.scanStatus.skills')}
          </div>
        </div>

        {/* 进度条 - 占据剩余全部空间 */}
        <div className="flex-1">
          <div className="relative w-full h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
            {/* 背景扫描线动画 */}
            {isScanning && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-terminal-cyan/20 to-transparent animate-scan-line"></div>
            )}

            <div
              className={`
                h-full transition-all duration-500 rounded-full relative
                ${isScanning
                  ? 'bg-gradient-to-r from-terminal-cyan/70 to-terminal-cyan'
                  : isComplete && issueCount === 0
                  ? 'bg-gradient-to-r from-terminal-green/70 to-terminal-green'
                  : isComplete && issueCount > 0
                  ? 'bg-gradient-to-r from-terminal-yellow/70 to-terminal-yellow'
                  : 'bg-gradient-to-r from-terminal-cyan/70 to-terminal-cyan'
                }
              `}
              style={{ width: `${progress}%` }}
            >
              {/* 进度条发光效果 */}
              {isScanning && (
                <div className="absolute inset-0 bg-terminal-cyan opacity-50 animate-pulse"></div>
              )}
            </div>
          </div>

          {/* 进度文本 */}
          {isComplete && !isScanning && (
            <div className="flex items-center gap-2 mt-2 text-sm">
              <CheckCircle className="w-4 h-4 text-terminal-green" />
              <span className="text-muted-foreground font-mono">
                {issueCount === 0
                  ? t('overview.scanStatus.noIssues')
                  : t('overview.scanStatus.completed', { count: issueCount })
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 测试计划

### 任务 1 测试：
1. 打开技能市场页面，验证技能卡片上只有安装/卸载按钮，没有删除按钮
2. 验证卸载按钮有垃圾桶图标
3. 打开我的技能页面，验证同样的改动
4. 验证所有按钮的交互和加载状态正常

### 任务 2 测试：
1. 打开我的技能页面
2. 验证搜索框右侧有仓库筛选下拉框
3. 验证筛选下拉框右侧有"扫描本地"按钮
4. 测试仓库筛选功能，验证能正确过滤技能
5. 点击"扫描本地"按钮，验证扫描功能正常，显示正确的提示信息

### 任务 3 测试：
1. 打开仓库管理页面，点击"添加仓库"
2. 验证表单中先显示 GitHub URL 输入框
3. 输入一个 GitHub URL（如 https://github.com/anthropics/claude-skills）
4. 验证仓库名称自动填充为 "anthropics"
5. 手动修改仓库名称，验证可以修改
6. 清空 URL，重新输入另一个 URL，验证自动提取仍然工作
7. 提交表单，验证添加成功

### 任务 4 测试：
1. 打开系统概览页面
2. 验证"一键扫描"按钮在页面标题右侧
3. 验证扫描状态卡片中进度条占据了更多空间
4. 点击扫描按钮，验证扫描功能正常
5. 观察进度条动画和状态更新

---

## 提交计划

完成所有任务后，创建一个 git commit：

```bash
git add src/components/MarketplacePage.tsx src/components/InstalledSkillsPage.tsx src/components/RepositoriesPage.tsx src/components/OverviewPage.tsx src/components/overview/ScanStatusCard.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "$(cat <<'EOF'
feat: optimize UI across multiple pages

优化了多个页面的用户界面：

1. 技能卡片优化
   - 移除技能市场和我的技能页面的删除按钮
   - 为卸载按钮添加图标，与安装按钮风格统一

2. 我的技能页面增强
   - 添加仓库来源筛选下拉框
   - 添加"扫描本地"按钮，支持快速刷新本地技能

3. 仓库添加流程优化
   - 调整表单顺序，先输入 GitHub URL
   - 自动从 URL 提取仓库所有者作为仓库名称
   - 支持用户手动修改自动提取的名称

4. 系统概览页面布局调整
   - 将"一键扫描"按钮移至页面标题右侧
   - 扫描状态卡片中进度条占据更多空间
   - 优化整体布局和视觉层次

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```
