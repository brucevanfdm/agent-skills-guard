# 概览页面重构设计方案

**日期**: 2026-01-02
**状态**: 设计完成，待实现

## 概述

将当前的"安全扫描"页面重构为"概览"页面，采用卡片式布局展示系统整体状态，避免与技能列表页面的功能重复。

## 设计目标

1. **统计信息集中展示**：已安装技能数量、仓库数量、扫描统计
2. **扫描状态可视化**：实时进度、最近扫描时间、问题发现数
3. **问题快速定位**：按风险等级汇总、有问题的技能列表
4. **便捷操作**：快捷打开技能目录、查看详细报告、一键扫描
5. **技能列表集成**：在技能卡片上显示安全评分

## 整体架构

### 路由和导航调整

- **路由变更**: `/security` → `/overview`
- **导航文案**: "安全扫描" → "概览"
- **i18n 更新**:
  - `security: "安全扫描"` → `overview: "概览"`
  - 新增相关翻译键

### 组件结构

```
OverviewPage.tsx (新建)
├── StatisticsCards.tsx (新建)
│   ├── 已安装技能卡片
│   ├── 仓库数量卡片
│   └── 扫描总数卡片
├── ScanStatusCard.tsx (新建)
│   ├── 扫描信息展示
│   ├── 进度条
│   └── 一键扫描按钮
├── IssuesSummaryCard.tsx (新建)
│   └── 五个风险等级统计（Critical/High/Medium/Low/Safe）
└── IssuesList.tsx (新建)
    └── 有问题的技能卡片列表
        ├── 技能信息 + 评分
        ├── 操作按钮（打开目录/查看详情/卸载）
        └── 问题预览（可展开）

SecurityDetailDialog.tsx (复用现有)
```

### 废弃组件

- `SecurityDashboard.tsx`（当前的表格式界面将被完全替换）

## 详细设计

### 第一行：统计卡片（StatisticsCards）

**布局**: `grid grid-cols-3 gap-4`，每个卡片高度 ~120px

#### 1. 已安装技能卡片（蓝色主题）
- **图标**: 📦 Package
- **数据源**: `getInstalledSkills().length`
- **标签**: "已安装技能"
- **样式**:
  - 背景: `bg-blue-50` / `dark:bg-blue-950`
  - 数字: `text-blue-600` / `dark:text-blue-400`
  - 字体: `text-4xl font-bold`

#### 2. 仓库数量卡片（绿色主题）
- **图标**: 🗂️ FolderGit
- **数据源**: `getRepositories().length`
- **标签**: "已添加仓库"
- **样式**:
  - 背景: `bg-green-50` / `dark:bg-green-950`
  - 数字: `text-green-600` / `dark:text-green-400`

#### 3. 扫描总数卡片（紫色主题）
- **图标**: 🔍 Shield
- **数据源**: `get_scan_results().length`（已扫描的技能数）
- **标签**: "已扫描技能"
- **样式**:
  - 背景: `bg-purple-50` / `dark:bg-purple-950`
  - 数字: `text-purple-600` / `dark:text-purple-400`

### 第二行：扫描状态卡片（ScanStatusCard）

**布局**: `flex justify-between items-center`，高度 ~100px

#### 左侧：扫描信息区
```
最近扫描：2 小时前
已扫描 15/20 个技能
```

**数据计算**:
- 最近扫描时间：`max(scan_results.map(r => r.scanned_at))`，格式化为相对时间
- 已扫描数：`scan_results.length`
- 总技能数：`installed_skills.length`

#### 中间：进度条区
- **进度计算**: `(已扫描数 / 总技能数) * 100%`
- **扫描中状态**: 显示动画进度条（`animate-pulse`）
- **完成状态**: 绿色进度条 + 消息
  - 示例：`✓ 扫描完成，发现 3 个问题`
  - 问题数：筛选 `level !== 'Safe'` 统计

#### 右侧：操作按钮
- **文案**: "一键扫描"
- **扫描中状态**:
  - 文字：`扫描中...`
  - 图标：loading spinner
  - 禁用点击
- **点击行为**: 调用 `scan_all_installed_skills()`

### 第三行：问题汇总卡片（IssuesSummaryCard）

**布局**: `grid grid-cols-5 gap-4`

#### 五个风险等级统计列

| 等级 | 图标 | 筛选条件 | 颜色 |
|------|------|----------|------|
| Critical（严重） | ⚠️ AlertTriangle | `level === 'Critical'` | `text-red-600` / `bg-red-50` |
| High（高风险） | ⚡ Zap | `level === 'High'` | `text-orange-600` / `bg-orange-50` |
| Medium（中风险） | ⚠️ AlertCircle | `level === 'Medium'` | `text-yellow-600` / `bg-yellow-50` |
| Low（低风险） | ℹ️ Info | `level === 'Low'` | `text-blue-600` / `bg-blue-50` |
| Safe（安全） | ✓ CheckCircle | `level === 'Safe'` | `text-green-600` / `bg-green-50` |

#### 交互功能
- **可点击过滤**: 点击任一等级列，问题详情列表只显示该等级的技能
- **选中高亮**: 当前过滤等级显示加粗边框
- **默认状态**: 显示所有等级（无过滤）

### 第四行：问题详情列表（IssuesList）

#### 筛选逻辑
- **默认**: 只显示 `level !== 'Safe'` 的技能
- **排序**: Critical > High > Medium > Low
- **过滤**: 响应问题汇总卡片的点击

#### 技能卡片结构

**顶部栏** (`flex justify-between items-center`)
- **左侧**: 技能名称（粗体）+ 风险等级徽章
- **中间**: 安全评分（大号显示，如 `45 分`，颜色编码）
- **右侧**: 操作按钮组
  1. 📂 **打开目录** - 调用 `open_skill_directory(skill.local_path)`
  2. 🔍 **查看详情** - 打开 `SecurityDetailDialog`
  3. 🗑️ **卸载** - 调用 `uninstallSkill`（带二次确认）

**问题预览区** (可展开/折叠)
- **默认折叠**: 显示摘要
  - 格式：`发现 5 个问题：2 个 Critical，3 个 High`
  - 数据：从 `report.issues` 统计
- **展开状态**: 显示前 3 个最严重的问题
  - 每行：严重程度图标 + 描述（单行，超出省略）
  - 底部："查看完整报告"链接（打开 SecurityDetailDialog）

**空状态**（所有技能都安全）
```
✓ 太棒了！所有技能都很安全
最近扫描：2 小时前
```

## 技能列表页面集成

### SkillsPage.tsx 改动

#### 卡片顶部栏增强
在安装状态徽章旁边添加安全评分徽章：

```tsx
{skill.security_score !== null && (
  <Badge variant={getScoreBadgeVariant(skill.security_score)}>
    🛡️ {skill.security_score} 分
  </Badge>
)}
{skill.security_score === null && (
  <Badge variant="secondary">未扫描</Badge>
)}
```

**颜色映射**:
- 90-100: 绿色 (`success`)
- 70-89: 黄色 (`warning`)
- 50-69: 橙色 (`destructive`)
- 0-49: 红色 (`destructive`)

#### 详情展开区简化
- **保留**: 评分 + 风险等级 + 问题数量摘要
- **移除**: 详细问题列表（引导用户去概览页面查看）
- **新增**: "在概览页面查看详情"链接

## Tauri 命令实现

### 新增命令：open_skill_directory

**位置**: `src-tauri/src/commands/mod.rs`

```rust
#[tauri::command]
pub async fn open_skill_directory(local_path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&local_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&local_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&local_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}
```

**前端 API** (`src/lib/api.ts`):

```typescript
export const openSkillDirectory = (localPath: string) =>
    invoke<void>('open_skill_directory', { localPath });
```

### 注册命令

在 `src-tauri/src/main.rs` 的 `invoke_handler!` 中添加：

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    open_skill_directory,
])
```

## 数据流

### 现有 API 复用
- `scan_all_installed_skills()`: 触发全量扫描
- `get_scan_results()`: 获取缓存的扫描结果
- `getInstalledSkills()`: 获取已安装技能列表
- `getRepositories()`: 获取仓库列表

### 新增 Hook
```typescript
// useOverview.ts
export const useOverview = () => {
  const { data: installedSkills } = useInstalledSkills();
  const { data: repositories } = useRepositories();
  const { data: scanResults } = useScanResults();

  const statistics = useMemo(() => ({
    installedCount: installedSkills?.length || 0,
    repositoryCount: repositories?.length || 0,
    scannedCount: scanResults?.length || 0,
  }), [installedSkills, repositories, scanResults]);

  const issuesByLevel = useMemo(() => {
    const levels = ['Critical', 'High', 'Medium', 'Low', 'Safe'];
    return levels.reduce((acc, level) => {
      acc[level] = scanResults?.filter(r => r.level === level).length || 0;
      return acc;
    }, {} as Record<string, number>);
  }, [scanResults]);

  const lastScanTime = useMemo(() => {
    if (!scanResults?.length) return null;
    return new Date(Math.max(...scanResults.map(r => new Date(r.scanned_at).getTime())));
  }, [scanResults]);

  return { statistics, issuesByLevel, lastScanTime };
};
```

## 响应式设计

### 移动端适配 (< 768px)
- 统计卡片：`grid-cols-3` → `grid-cols-1`（垂直堆叠）
- 问题汇总：`grid-cols-5` → `grid-cols-2`（两行显示）
- 扫描状态卡片：`flex-row` → `flex-col`（垂直布局）
- 问题卡片操作按钮：横向 → 垂直堆叠

### 平板端适配 (768px - 1024px)
- 统计卡片：保持 `grid-cols-3`
- 问题汇总：`grid-cols-5` → `grid-cols-3`（第二行显示剩余）

## 动画和过渡

- **卡片加载**: `fadeIn 0.4s` 阶梯延迟（50ms 间隔）
- **进度条**: 扫描中使用 `animate-pulse`
- **展开/折叠**: `transition-all duration-300`
- **悬停效果**: 所有卡片 `hover:shadow-lg transition-shadow`

## 国际化

### 新增翻译键 (zh.json)

```json
{
  "overview": "概览",
  "statistics": {
    "installedSkills": "已安装技能",
    "repositories": "已添加仓库",
    "scannedSkills": "已扫描技能"
  },
  "scanStatus": {
    "lastScan": "最近扫描",
    "scanned": "已扫描",
    "scanAll": "一键扫描",
    "scanning": "扫描中...",
    "completed": "扫描完成，发现 {count} 个问题",
    "noIssues": "扫描完成，未发现问题"
  },
  "riskLevels": {
    "critical": "严重",
    "high": "高风险",
    "medium": "中风险",
    "low": "低风险",
    "safe": "安全"
  },
  "issues": {
    "found": "发现 {count} 个问题：{breakdown}",
    "viewDetails": "查看详情",
    "viewFullReport": "查看完整报告",
    "noIssues": "太棒了！所有技能都很安全",
    "openDirectory": "打开目录",
    "uninstall": "卸载"
  }
}
```

## 实现顺序建议

1. **基础架构** (1-2 小时)
   - 创建新组件文件结构
   - 更新路由和导航
   - 添加 i18n 翻译

2. **统计卡片** (1 小时)
   - 实现 StatisticsCards 组件
   - 连接数据源

3. **扫描状态卡片** (1-2 小时)
   - 实现 ScanStatusCard 组件
   - 集成扫描 mutation
   - 添加进度条逻辑

4. **问题汇总卡片** (1 小时)
   - 实现 IssuesSummaryCard 组件
   - 添加过滤交互

5. **问题详情列表** (2-3 小时)
   - 实现 IssuesList 组件
   - 添加展开/折叠功能
   - 集成操作按钮

6. **Tauri 命令** (0.5 小时)
   - 实现 open_skill_directory 命令
   - 测试跨平台兼容性

7. **技能列表集成** (1 小时)
   - 更新 SkillsPage 卡片
   - 添加评分徽章

8. **测试和优化** (1-2 小时)
   - 测试所有交互
   - 调整动画和样式
   - 响应式布局测试

**预计总时间**: 8-12 小时

## 注意事项

1. **数据一致性**: 扫描后需要同时刷新概览页面和技能列表页面的数据
2. **性能优化**: 使用 `useMemo` 缓存计算结果，避免重复计算
3. **错误处理**: 打开目录命令失败时显示 toast 提示
4. **权限验证**: 卸载操作需要二次确认
5. **深色模式**: 所有颜色需要适配深色主题

## 后续扩展可能性

1. **趋势图表**: 展示安全评分随时间的变化趋势
2. **定时扫描**: 支持设置定时自动扫描
3. **导出报告**: 导出 PDF 或 JSON 格式的安全报告
4. **批量操作**: 批量卸载有问题的技能
5. **通知系统**: 发现高风险技能时桌面通知

---

**设计确认时间**: 2026-01-02
**下一步**: 创建实现计划，准备进入开发阶段
