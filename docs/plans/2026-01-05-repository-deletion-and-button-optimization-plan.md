# 仓库删除同步技能清理和按钮优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现删除仓库时自动清理未安装技能和缓存，并优化仓库按钮 UI

**Architecture:** 后端在 delete_repository 命令中添加事务处理，删除未安装技能和清理缓存目录。前端合并扫描和刷新缓存按钮，根据缓存状态智能显示。

**Tech Stack:** Rust (Tauri), React, TypeScript, SQLite, React Query

---

## Task 1: 添加数据库辅助方法 - 删除未安装技能

**Files:**
- Modify: `src-tauri/src/services/database.rs:263-267`

**Step 1: 在 Database 结构体中添加删除未安装技能的方法**

在 `delete_repository` 方法后添加新方法：

```rust
/// 删除指定仓库的所有未安装技能
pub fn delete_uninstalled_skills_by_repository_url(&self, repository_url: &str) -> Result<usize> {
    let conn = self.conn.lock().unwrap();
    let deleted_count = conn.execute(
        "DELETE FROM skills WHERE repository_url = ?1 AND installed = 0",
        params![repository_url]
    )?;
    Ok(deleted_count)
}
```

**Step 2: 验证代码编译**

Run: `cd src-tauri && cargo check`
Expected: SUCCESS - 编译通过

**Step 3: 提交更改**

```bash
git add src-tauri/src/services/database.rs
git commit -m "feat: 添加删除未安装技能的数据库方法"
```

---

## Task 2: 修改 delete_repository 命令实现

**Files:**
- Modify: `src-tauri/src/commands/mod.rs:38-46`

**Step 1: 重写 delete_repository 命令实现**

完全替换当前的 `delete_repository` 函数（第 38-46 行）：

```rust
/// 删除仓库（同时删除未安装的技能和清理缓存）
#[tauri::command]
pub async fn delete_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    // 1. 获取仓库信息
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "仓库不存在".to_string())?;

    let repository_url = repo.url.clone();
    let cache_path = repo.cache_path.clone();

    // 2. 删除未安装的技能（使用事务）
    let deleted_skills_count = state.db.delete_uninstalled_skills_by_repository_url(&repository_url)
        .map_err(|e| e.to_string())?;

    log::info!("删除仓库 {} 的 {} 个未安装技能", repo.name, deleted_skills_count);

    // 3. 清理缓存目录（失败不中断）
    if let Some(cache_path_str) = cache_path {
        let cache_path_buf = std::path::PathBuf::from(&cache_path_str);
        if cache_path_buf.exists() {
            match std::fs::remove_dir_all(&cache_path_buf) {
                Ok(_) => log::info!("成功删除缓存目录: {:?}", cache_path_buf),
                Err(e) => log::warn!("删除缓存目录失败，但不影响仓库删除: {:?}, 错误: {}", cache_path_buf, e),
            }
        } else {
            log::info!("缓存目录不存在，跳过清理: {:?}", cache_path_buf);
        }
    }

    // 4. 删除仓库记录
    state.db.delete_repository(&repo_id)
        .map_err(|e| e.to_string())?;

    log::info!("成功删除仓库: {}", repo.name);
    Ok(())
}
```

**Step 2: 验证代码编译**

Run: `cd src-tauri && cargo check`
Expected: SUCCESS - 编译通过

**Step 3: 提交更改**

```bash
git add src-tauri/src/commands/mod.rs
git commit -m "feat: 增强删除仓库功能，同步删除未安装技能和清理缓存"
```

---

## Task 3: 更新前端 Hook - 刷新技能列表

**Files:**
- Modify: `src/hooks/useRepositories.ts:23-31`

**Step 1: 修改 useDeleteRepository hook**

在 `onSuccess` 回调中添加技能列表刷新：

```typescript
export function useDeleteRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (repoId: string) => api.deleteRepository(repoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
```

**Step 2: 验证代码编译**

Run: `cd .. && pnpm typecheck`
Expected: SUCCESS - 类型检查通过

**Step 3: 提交更改**

```bash
git add src/hooks/useRepositories.ts
git commit -m "feat: 删除仓库后刷新技能列表"
```

---

## Task 4: 移除清理缓存相关代码

**Files:**
- Modify: `src/components/RepositoriesPage.tsx:8,56-66,148-150`

**Step 1: 移除 Trash 图标导入**

修改第 8 行，移除 `Trash` 图标：

```typescript
import { Search, Plus, Trash2, GitBranch, Loader2, Database, X, Terminal, RefreshCw } from "lucide-react";
```

**Step 2: 移除 clearCacheMutation 定义**

删除第 56-66 行：

```typescript
// 删除这段代码
// 清理缓存mutation
const clearCacheMutation = useMutation({
  mutationFn: api.clearRepositoryCache,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    showToast(t('repositories.cache.cleared'));
  },
  onError: (error: any) => {
    showToast(t('repositories.cache.clearFailed', { error: error.message || error }));
  },
});
```

**Step 3: 移除 handleClearCache 函数**

删除第 148-150 行：

```typescript
// 删除这段代码
const handleClearCache = (repoId: string) => {
  clearCacheMutation.mutate(repoId);
};
```

**Step 4: 验证代码编译**

Run: `pnpm typecheck`
Expected: SUCCESS - 类型检查通过

**Step 5: 提交更改**

```bash
git add src/components/RepositoriesPage.tsx
git commit -m "refactor: 移除清理缓存相关代码"
```

---

## Task 5: 实现智能扫描按钮

**Files:**
- Modify: `src/components/RepositoriesPage.tsx:412-481`

**Step 1: 替换按钮渲染逻辑**

完全替换第 412-481 行的按钮部分：

```typescript
                {/* Action Buttons */}
                <div className="flex gap-2 ml-4">
                  {/* 智能扫描按钮 */}
                  <button
                    onClick={() => {
                      if (repo.cache_path) {
                        // 已缓存：重新扫描
                        refreshCacheMutation.mutate(repo.id, {
                          onSuccess: (skills) => {
                            showToast(t('repositories.toast.foundSkills', { count: skills.length }));
                          },
                          onError: (error: any) => {
                            showToast(`${t('repositories.toast.scanError')}${error.message || error}`);
                          },
                        });
                      } else {
                        // 未缓存：一键扫描
                        setScanningRepoId(repo.id);
                        scanMutation.mutate(repo.id, {
                          onSuccess: (skills) => {
                            setScanningRepoId(null);
                            showToast(t('repositories.toast.foundSkills', { count: skills.length }));
                          },
                          onError: (error: any) => {
                            setScanningRepoId(null);
                            showToast(`${t('repositories.toast.scanError')}${error.message || error}`);
                          },
                        });
                      }
                    }}
                    disabled={scanMutation.isPending || refreshCacheMutation.isPending || deleteMutation.isPending}
                    className="neon-button disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 text-xs"
                  >
                    {(scanningRepoId === repo.id && scanMutation.isPending) || refreshCacheMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {repo.cache_path ? t('repositories.rescanning') : t('repositories.scanning')}
                      </>
                    ) : (
                      <>
                        {repo.cache_path ? <RefreshCw className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                        {repo.cache_path ? t('repositories.rescan') : t('repositories.scan')}
                      </>
                    )}
                  </button>

                  {/* 删除按钮 */}
                  <button
                    onClick={() => {
                      setDeletingRepoId(repo.id);
                      deleteMutation.mutate(repo.id, {
                        onSuccess: () => {
                          setDeletingRepoId(null);
                        },
                        onError: () => {
                          setDeletingRepoId(null);
                        },
                      });
                    }}
                    disabled={scanMutation.isPending || deleteMutation.isPending}
                    className="px-3 py-2 rounded font-mono text-xs border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingRepoId === repo.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
```

**Step 2: 验证代码编译**

Run: `pnpm typecheck`
Expected: SUCCESS - 类型检查通过

**Step 3: 提交更改**

```bash
git add src/components/RepositoriesPage.tsx
git commit -m "feat: 实现智能扫描按钮，根据缓存状态显示不同文案"
```

---

## Task 6: 更新中文翻译文件

**Files:**
- Modify: `src/i18n/locales/zh.json`

**Step 1: 读取当前翻译文件**

Run: `cat src/i18n/locales/zh.json`

**Step 2: 更新 repositories 翻译**

在 `repositories` 对象中：
- 修改 `scan` 为 "一键扫描"
- 添加 `rescan: "重新扫描"`
- 添加 `rescanning: "重新扫描中..."`
- 移除 `cache.clear`, `cache.clearTooltip`, `cache.clearing`, `cache.cleared`, `cache.clearFailed`

找到 repositories.cache 部分，更新为：

```json
"repositories": {
  "scan": "一键扫描",
  "rescan": "重新扫描",
  "scanning": "扫描中...",
  "rescanning": "重新扫描中...",
  "cache": {
    "stats": "缓存统计",
    "totalRepos": "仓库总数",
    "cached": "已缓存",
    "size": "缓存大小",
    "statusCached": "已缓存",
    "statusUncached": "未缓存",
    "refresh": "刷新缓存",
    "refreshTooltip": "刷新此仓库的缓存，获取最新内容",
    "refreshing": "刷新中...",
    "refreshed": "刷新成功，找到 {{count}} 个技能",
    "refreshFailed": "刷新缓存失败: {{error}}"
  }
}
```

**Step 3: 验证 JSON 格式**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json', 'utf8'))"`
Expected: 无输出（表示 JSON 格式正确）

**Step 4: 提交更改**

```bash
git add src/i18n/locales/zh.json
git commit -m "i18n: 更新中文翻译，添加智能扫描按钮文案"
```

---

## Task 7: 更新英文翻译文件

**Files:**
- Modify: `src/i18n/locales/en.json`

**Step 1: 读取当前翻译文件**

Run: `cat src/i18n/locales/en.json`

**Step 2: 更新 repositories 翻译**

在 `repositories` 对象中：
- 修改 `scan` 为 "Quick Scan"
- 添加 `rescan: "Rescan"`
- 添加 `rescanning: "Rescanning..."`
- 移除清理缓存相关的 keys

找到 repositories.cache 部分，更新为：

```json
"repositories": {
  "scan": "Quick Scan",
  "rescan": "Rescan",
  "scanning": "Scanning...",
  "rescanning": "Rescanning...",
  "cache": {
    "stats": "Cache Statistics",
    "totalRepos": "Total Repositories",
    "cached": "Cached",
    "size": "Cache Size",
    "statusCached": "Cached",
    "statusUncached": "Not Cached",
    "refresh": "Refresh Cache",
    "refreshTooltip": "Refresh cache for this repository to get the latest content",
    "refreshing": "Refreshing...",
    "refreshed": "Refresh successful, found {{count}} skills",
    "refreshFailed": "Failed to refresh cache: {{error}}"
  }
}
```

**Step 3: 验证 JSON 格式**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json', 'utf8'))"`
Expected: 无输出（表示 JSON 格式正确）

**Step 4: 提交更改**

```bash
git add src/i18n/locales/en.json
git commit -m "i18n: 更新英文翻译，添加智能扫描按钮文案"
```

---

## Task 8: 功能测试和验证

**Files:**
- Test: 应用功能测试

**Step 1: 启动开发服务器**

Run: `pnpm tauri dev`
Expected: 应用成功启动

**Step 2: 测试删除仓库功能**

手动测试：
1. 添加一个测试仓库（例如：https://github.com/anthropics/anthropic-quickstarts）
2. 点击"一键扫描"，等待扫描完成
3. 在技能市场页面，确认能看到该仓库的技能
4. 安装该仓库的某个技能
5. 回到仓库管理页面，删除该仓库
6. 验证：
   - 仓库已从列表中消失
   - 未安装的技能已从技能市场消失
   - 已安装的技能仍在"我的技能"页面
   - 检查缓存目录是否被清理（Windows: `%LOCALAPPDATA%\agent-skills-guard\cache\repositories`）

**Step 3: 测试智能扫描按钮**

手动测试：
1. 添加新仓库，验证显示"一键扫描"按钮
2. 点击"一键扫描"，验证扫描成功
3. 验证按钮变为"重新扫描"
4. 点击"重新扫描"，验证缓存刷新成功

**Step 4: 测试边界情况**

1. 删除一个没有技能的仓库（应正常删除）
2. 删除一个所有技能都已安装的仓库（应正常删除，不删除任何技能）
3. 删除一个没有缓存的仓库（应正常删除）

**Step 5: 记录测试结果**

创建测试报告文档：`docs/test-reports/2026-01-05-repository-deletion-button-optimization.md`

**Step 6: 如果所有测试通过，提交最终版本**

```bash
git add .
git commit -m "test: 完成仓库删除和按钮优化功能测试"
```

---

## 验收标准

- [ ] 删除仓库时，未安装的技能被自动删除
- [ ] 删除仓库时，已安装的技能被保留
- [ ] 删除仓库时，缓存目录被清理
- [ ] 未缓存的仓库显示"一键扫描"按钮
- [ ] 已缓存的仓库显示"重新扫描"按钮
- [ ] 点击"一键扫描"成功扫描仓库
- [ ] 点击"重新扫描"成功刷新缓存
- [ ] 清理缓存按钮已被移除
- [ ] 中英文翻译文件已更新
- [ ] 所有功能测试通过

---

## 回滚计划

如果实施过程中出现问题，按以下顺序回滚：

1. 回滚前端更改：
   ```bash
   git revert <commit-hash-task-3-to-7>
   ```

2. 回滚后端更改：
   ```bash
   git revert <commit-hash-task-1-2>
   ```

3. 重新构建并测试：
   ```bash
   pnpm tauri build
   ```
