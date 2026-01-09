# 多路径技能安装功能实现计划

## 概述

为 Agent Skills Guard 添加支持自定义安装路径的功能，允许用户在安装技能时选择安装到用户目录或自定义项目目录，并记录最近使用的 3 个安装路径作为快捷选择。

## 核心需求

1. **所有技能安装都需要路径选择**
   - 无风险技能：弹出简化的路径选择弹窗
   - 风险技能：在安全警告弹窗中集成路径选择器

2. **支持的安装路径类型**
   - 用户目录：`~/.claude/skills/`（默认）
   - 自定义目录：用户通过文件选择器选择任意目录

3. **最近路径快捷选择**
   - 使用 localStorage 存储最近使用的 3 个安装路径
   - 在路径选择器中展示，方便快速选择

4. **扫描增强**
   - 扫描所有已使用的安装路径
   - 从数据库提取 unique 的 local_path 父目录进行扫描

## 技术架构

### 应用类型
独立桌面应用（Tauri 跨平台应用），不依赖 VSCode 环境

### 路径管理策略
- **预设路径**：用户目录 `~/.claude/skills/`
- **自定义路径**：通过 `@tauri-apps/plugin-dialog` 文件选择器让用户选择
- **路径验证**：检查路径可读写权限
- **路径存储**：使用现有的 `local_path` 字段存储完整路径

### 数据存储
- **数据库**：无需修改 schema，使用现有 `local_path TEXT` 字段
- **最近路径**：localStorage 存储，key 为 `recentInstallPaths`，值为字符串数组

## 实现计划

### 1. 后端改动

#### 1.1 新增 Command - 获取默认安装路径
**文件**：[src-tauri/src/commands/mod.rs](src-tauri/src/commands/mod.rs)

```rust
/// 获取默认的用户目录安装路径
#[tauri::command]
pub async fn get_default_install_path() -> Result<String, String> {
    let user_path = dirs::home_dir()
        .ok_or("无法获取用户主目录")?
        .join(".claude")
        .join("skills");

    Ok(user_path.to_string_lossy().to_string())
}
```

**注册 command**：在 `lib.rs` 的 `invoke_handler` 中添加

#### 1.2 新增 Command - 选择自定义路径
**文件**：[src-tauri/src/commands/mod.rs](src-tauri/src/commands/mod.rs)

```rust
use tauri_plugin_dialog::DialogExt;

/// 打开文件夹选择器，让用户选择自定义安装路径
#[tauri::command]
pub async fn select_custom_install_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder_path = app.dialog()
        .file()
        .set_title("选择技能安装目录")
        .blocking_pick_folder();

    if let Some(path) = folder_path {
        // 验证路径可写
        let test_file = path.join(".write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_file);
                Ok(Some(path.to_string_lossy().to_string()))
            }
            Err(_) => Err("选择的目录不可写，请检查权限".to_string())
        }
    } else {
        Ok(None)
    }
}
```

**注册 command**：在 `lib.rs` 的 `invoke_handler` 中添加

#### 1.3 修改 `confirm_skill_installation` - 支持安装路径参数
**文件**：[src-tauri/src/services/skill_manager.rs](src-tauri/src/services/skill_manager.rs)

**修改方法签名**（约第 304 行）：
```rust
// 原签名
pub fn confirm_skill_installation(&self, skill_id: &str) -> Result<()>

// 新签名
pub fn confirm_skill_installation(&self, skill_id: &str, install_path: Option<String>) -> Result<()>
```

**核心逻辑变更**：
```rust
pub fn confirm_skill_installation(&self, skill_id: &str, install_path: Option<String>) -> Result<()> {
    let mut skill = self.db.get_skills()?
        .into_iter()
        .find(|s| s.id == skill_id)
        .context("未找到该技能")?;

    // 如果指定了新的安装路径，需要移动文件
    if let Some(new_base_path) = install_path {
        let current_path = skill.local_path.as_ref()
            .context("技能尚未下载")?;

        let current_dir = PathBuf::from(current_path);
        let new_base_dir = PathBuf::from(&new_base_path);

        // 获取技能目录名（当前路径的最后一个部分）
        let skill_dir_name = current_dir.file_name()
            .context("无效的技能目录名")?;
        let new_dir = new_base_dir.join(skill_dir_name);

        // 确保目标基础目录存在
        std::fs::create_dir_all(&new_base_dir)
            .context("无法创建目标目录")?;

        // 移动文件
        if new_dir != current_dir {
            std::fs::rename(&current_dir, &new_dir)
                .context("移动技能文件失败，请检查目标路径权限")?;

            log::info!("Moved skill from {:?} to {:?}", current_dir, new_dir);

            // 更新 local_path
            skill.local_path = Some(new_dir.to_string_lossy().to_string());
        }
    }

    // 标记为已安装
    skill.installed = true;
    skill.installed_at = Some(Utc::now());

    self.db.save_skill(&skill)?;
    log::info!("Skill installation confirmed: {}", skill.name);

    Ok(())
}
```

#### 1.4 修改 Command 签名
**文件**：[src-tauri/src/commands/mod.rs](src-tauri/src/commands/mod.rs)（约第 208 行）

```rust
// 原签名
#[tauri::command]
pub async fn confirm_skill_installation(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<(), String> {
    state.skill_manager.confirm_skill_installation(&skill_id)
        .map_err(|e| e.to_string())
}

// 新签名
#[tauri::command]
pub async fn confirm_skill_installation(
    state: State<'_, AppState>,
    skill_id: String,
    install_path: Option<String>,  // 新增参数
) -> Result<(), String> {
    state.skill_manager.confirm_skill_installation(&skill_id, install_path)
        .map_err(|e| e.to_string())
}
```

#### 1.5 修改 `scan_local_skills` - 扫描多个路径
**文件**：[src-tauri/src/services/skill_manager.rs](src-tauri/src/services/skill_manager.rs)（约第 406 行）

**核心逻辑变更**：
```rust
pub fn scan_local_skills(&self) -> Result<Vec<Skill>> {
    use std::collections::HashSet;

    let mut scanned_skills = Vec::new();

    // 1. 获取所有 unique 的 local_path 父目录
    let installed_skills = self.db.get_skills()?;
    let mut scan_dirs: HashSet<PathBuf> = HashSet::new();

    // 从已安装技能的 local_path 提取父目录
    for skill in &installed_skills {
        if let Some(local_path) = &skill.local_path {
            if let Some(parent) = PathBuf::from(local_path).parent() {
                scan_dirs.insert(parent.to_path_buf());
            }
        }
    }

    // 2. 添加默认的用户目录（确保始终扫描）
    scan_dirs.insert(self.skills_dir.clone());

    log::info!("Will scan {} directories for local skills", scan_dirs.len());

    // 3. 扫描所有目录
    for scan_dir in scan_dirs {
        if !scan_dir.exists() {
            log::debug!("Skipping non-existent directory: {:?}", scan_dir);
            continue;
        }

        log::info!("Scanning directory: {:?}", scan_dir);

        // 原有的扫描逻辑（遍历目录、解析 SKILL.md、扫描安全等）
        if let Ok(entries) = std::fs::read_dir(&scan_dir) {
            for entry in entries.flatten() {
                let path = entry.path();

                // 只处理目录
                if !path.is_dir() {
                    continue;
                }

                // 检查是否包含 SKILL.md
                let skill_md_path = path.join("SKILL.md");
                if !skill_md_path.exists() {
                    continue;
                }

                // ... 继续原有的解析和扫描逻辑 ...
            }
        }
    }

    log::info!("Scan completed, found {} local skills", scanned_skills.len());
    Ok(scanned_skills)
}
```

### 2. 前端改动

#### 2.1 新增类型定义
**文件**：[src/types/index.ts](src/types/index.ts)

```typescript
export interface InstallPathSelection {
  type: 'user' | 'recent' | 'custom';
  path: string;
  displayName: string;
}
```

#### 2.2 新增 localStorage 工具函数
**文件**：`src/lib/storage.ts`（新建）

```typescript
const RECENT_PATHS_KEY = 'recentInstallPaths';
const MAX_RECENT_PATHS = 3;

/**
 * 获取最近使用的安装路径列表
 */
export function getRecentInstallPaths(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PATHS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to get recent install paths:', error);
    return [];
  }
}

/**
 * 添加安装路径到最近使用列表
 * @param path 安装路径
 */
export function addRecentInstallPath(path: string): void {
  try {
    let paths = getRecentInstallPaths();

    // 移除重复项（不区分大小写比较）
    paths = paths.filter(p => p.toLowerCase() !== path.toLowerCase());

    // 添加到开头
    paths.unshift(path);

    // 限制数量为 3
    if (paths.length > MAX_RECENT_PATHS) {
      paths = paths.slice(0, MAX_RECENT_PATHS);
    }

    localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(paths));
  } catch (error) {
    console.warn('Failed to save recent install path:', error);
  }
}
```

详细的前端组件代码请参考完整实现文档的 2.3-2.7 节。

## 关键文件清单

### 后端文件（Rust）
1. **[src-tauri/src/services/skill_manager.rs](../../src-tauri/src/services/skill_manager.rs)** - 约 150 行改动
2. **[src-tauri/src/commands/mod.rs](../../src-tauri/src/commands/mod.rs)** - 约 70 行新增
3. **[src-tauri/src/lib.rs](../../src-tauri/src/lib.rs)** - 约 3 行改动

### 前端文件（TypeScript/React）
4. **`src/components/InstallPathSelector.tsx`**（新建）- 约 150 行
5. **`src/components/SimplePathSelectionDialog.tsx`**（新建）- 约 80 行
6. **[src/components/MarketplacePage.tsx](../../src/components/MarketplacePage.tsx)** - 约 100 行改动
7. **`src/lib/storage.ts`**（新建）- 约 40 行
8. **[src/types/index.ts](../../src/types/index.ts)** - 约 5 行新增
9. **[src/i18n/locales/zh.json](../../src/i18n/locales/zh.json)** 和 **[en.json](../../src/i18n/locales/en.json)** - 约 10 行新增（每个文件）

## 实现步骤（按依赖关系排序）

### Phase 1: 基础架构
1. 后端基础命令
2. 前端基础设施

### Phase 2: 路径选择 UI
3. 路径选择器组件
4. 简化弹窗组件

### Phase 3: 安装流程改造
5. 后端安装逻辑
6. 前端安装流程集成

### Phase 4: 扫描增强
7. 多路径扫描

### Phase 5: 测试与优化
8. 集成测试
9. 边界情况处理

## 测试验证

详细的测试场景请参考完整文档中的测试章节，包括：
- 7 个功能测试场景
- 5 个边界情况测试
- 完整的手动测试清单

## 关键技术细节

- **文件移动策略**：使用 `std::fs::rename` 进行原子性移动
- **路径验证**：检查可写权限（创建测试文件）
- **localStorage 容错**：所有操作使用 try-catch
- **扫描优化**：使用 HashSet 去重路径

## 潜在风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 文件移动失败 | 安装中断 | 提供详细错误信息，保留临时文件供重试 |
| 路径权限问题 | 无法安装 | 提前验证路径可写，友好提示用户 |
| localStorage 容量限制 | 最近路径丢失 | 限制最多 3 个路径，总大小很小 |
| 跨盘符移动（Windows） | 移动失败 | 使用 copy + delete 代替 rename（备选方案） |
| 并发安装冲突 | 数据不一致 | 当前设计不支持并发，UI 层禁用按钮 |

## 未来扩展

1. **路径别名**：允许用户为常用路径设置别名（如"工作项目"、"个人项目"）
2. **默认路径设置**：在应用设置中配置默认安装路径
3. **路径同步**：跨设备同步最近路径列表
4. **智能推荐**：根据技能类型推荐安装路径
