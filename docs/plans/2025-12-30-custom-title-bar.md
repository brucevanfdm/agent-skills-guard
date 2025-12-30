# 自定义深色标题栏实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 隐藏 Windows 系统白色标题栏，创建自定义深色标题栏，包含窗口控制按钮，完美融入赛博朋克主题。

**Architecture:** 通过设置 Tauri 的 `decorations: false` 隐藏系统标题栏，将应用内的 header 元素改造为可拖动的自定义标题栏，并添加窗口控制组件（最小化、最大化、关闭），使用 Tauri Window API 控制窗口行为。

**Tech Stack:** React, TypeScript, Tauri API (@tauri-apps/api/window), TailwindCSS, Lucide Icons

---

## Task 1: 修改 Tauri 配置隐藏系统标题栏

**Files:**
- Modify: `src-tauri/tauri.conf.json:40`

**Step 1: 修改窗口装饰配置**

在 `src-tauri/tauri.conf.json` 中，找到 `app.windows[0].decorations` 并设置为 `false`：

```json
{
  "app": {
    "windows": [
      {
        "title": "Agent Skills Guard",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": false,
        "center": true
      }
    ]
  }
}
```

**Step 2: 验证配置**

运行: `cat src-tauri/tauri.conf.json | grep -A 10 "windows"`
Expected: 看到 `"decorations": false`

**Step 3: 提交配置更改**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: hide system title bar for custom styling"
```

---

## Task 2: 创建 WindowControls 组件

**Files:**
- Create: `src/components/WindowControls.tsx`

**Step 1: 创建窗口控制组件文件**

创建 `src/components/WindowControls.tsx`：

```tsx
import { Minus, Square, X } from "lucide-react";
import { appWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const handleMinimize = () => {
    appWindow.minimize();
  };

  const handleMaximize = () => {
    appWindow.toggleMaximize();
  };

  const handleClose = () => {
    appWindow.close();
  };

  return (
    <div className="flex items-center gap-1">
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="group p-2 hover:bg-terminal-cyan/10 transition-colors duration-200 rounded"
        aria-label="Minimize window"
      >
        <Minus className="w-4 h-4 text-muted-foreground group-hover:text-terminal-cyan transition-colors" />
      </button>

      {/* Maximize/Restore Button */}
      <button
        onClick={handleMaximize}
        className="group p-2 hover:bg-terminal-cyan/10 transition-colors duration-200 rounded"
        aria-label="Maximize window"
      >
        <Square className="w-3.5 h-3.5 text-muted-foreground group-hover:text-terminal-cyan transition-colors" />
      </button>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="group p-2 hover:bg-terminal-red/20 transition-colors duration-200 rounded"
        aria-label="Close window"
      >
        <X className="w-4 h-4 text-muted-foreground group-hover:text-terminal-red transition-colors" />
      </button>
    </div>
  );
}
```

**Step 2: 验证组件创建**

运行: `cat src/components/WindowControls.tsx | head -20`
Expected: 看到组件导入和基本结构

**Step 3: 提交窗口控制组件**

```bash
git add src/components/WindowControls.tsx
git commit -m "feat: add window control buttons component"
```

---

## Task 3: 修改 Header 添加拖动区域和窗口控制

**Files:**
- Modify: `src/App.tsx:76-103`

**Step 1: 导入 WindowControls 组件**

在 `src/App.tsx` 顶部添加导入：

```tsx
import { WindowControls } from "./components/WindowControls";
```

**Step 2: 修改 Header 添加拖动区域和窗口控制**

修改 header 元素（第 76-103 行），添加 `data-tauri-drag-region` 和 WindowControls：

```tsx
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
```

**重要说明：**
- 整个 header 内容区域添加 `data-tauri-drag-region` 属性，使其可拖动
- 标题和 logo 添加 `pointer-events-none`，防止阻止拖动
- LanguageSwitcher 和 WindowControls 添加 `pointer-events-auto`，确保可点击
- 调整 padding 从 `py-6` 改为 `py-4`，让标题栏更紧凑

**Step 3: 验证代码修改**

运行: `grep -A 5 "data-tauri-drag-region" src/App.tsx`
Expected: 看到拖动区域和 pointer-events 类

**Step 4: 提交 Header 修改**

```bash
git add src/App.tsx
git commit -m "feat: integrate custom title bar with drag region and window controls"
```

---

## Task 4: 安装 Tauri API 依赖（如果需要）

**Files:**
- Check: `package.json`

**Step 1: 检查是否已安装 @tauri-apps/api**

运行: `grep "@tauri-apps/api" package.json`
Expected: 如果已存在，跳过此任务；如果不存在，继续下一步

**Step 2: 安装 Tauri API（仅在需要时）**

运行: `pnpm add @tauri-apps/api`
Expected: 依赖安装成功

**Step 3: 提交依赖更新（仅在需要时）**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add @tauri-apps/api for window controls"
```

---

## Task 5: 重启应用并测试功能

**Files:**
- None (testing phase)

**Step 1: 关闭现有开发服务器**

运行:
```bash
netstat -ano | findstr :5173
```
找到进程 ID，然后：
```bash
taskkill //PID <PID> //F
```

**Step 2: 启动开发服务器**

运行: `pnpm dev`
Expected: Tauri 应用启动，无系统标题栏

**Step 3: 测试窗口拖动功能**

- 点击并拖动 header 区域（标题和 logo 之间的空白处）
- Expected: 窗口可以被拖动
- 确保标题、logo、语言切换器、窗口按钮不会触发拖动

**Step 4: 测试窗口控制按钮**

- 点击最小化按钮（─）
  - Expected: 窗口最小化到任务栏
- 从任务栏恢复窗口，点击最大化按钮（□）
  - Expected: 窗口全屏显示
- 再次点击最大化按钮
  - Expected: 窗口恢复原始大小
- 点击关闭按钮（×）
  - Expected: 应用完全关闭

**Step 5: 验证视觉一致性**

- 标题栏应该显示深色背景（`bg-background/95`）
- 窗口控制按钮悬停时显示青色高亮（最小化、最大化）和红色高亮（关闭）
- 整体风格符合赛博朋克主题

**Step 6: 最终提交（如果有任何调整）**

```bash
git add .
git commit -m "test: verify custom title bar functionality"
```

---

## 完成检查清单

- [ ] Tauri 配置已修改为 `decorations: false`
- [ ] WindowControls 组件已创建，包含最小化、最大化、关闭按钮
- [ ] Header 添加了 `data-tauri-drag-region` 属性
- [ ] pointer-events 正确配置，拖动和点击都正常工作
- [ ] @tauri-apps/api 依赖已安装（如需要）
- [ ] 应用重启后无系统标题栏
- [ ] 窗口可以通过自定义标题栏拖动
- [ ] 所有窗口控制按钮功能正常
- [ ] 视觉风格一致，深色主题完整

---

## 潜在问题和解决方案

**问题 1: 拖动区域覆盖了可点击元素**
- 解决: 确保可点击元素（按钮、下拉框）添加 `pointer-events-auto` 类

**问题 2: 窗口无法拖动**
- 解决: 检查 `data-tauri-drag-region` 是否正确添加到容器 div，而不是 header 元素本身

**问题 3: Tauri API 导入错误**
- 解决: 确保 `@tauri-apps/api` 已安装，检查版本兼容性

**问题 4: 双击标题栏无法最大化/恢复**
- 解决: 这是正常的，因为我们使用自定义标题栏。可以通过添加 `onDoubleClick` 事件处理器来实现此功能（可选增强）

---

## 可选增强（不在当前计划中）

1. **双击最大化**: 在 drag-region 添加 `onDoubleClick` 触发 `toggleMaximize()`
2. **窗口状态图标切换**: 最大化时显示"恢复"图标，正常时显示"最大化"图标
3. **键盘快捷键**: Alt+F4 关闭，Win+↑ 最大化等
4. **平滑动画**: 窗口控制按钮悬停动画优化
