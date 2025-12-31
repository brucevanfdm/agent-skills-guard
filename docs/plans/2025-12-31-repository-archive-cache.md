# 仓库压缩包缓存功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现GitHub仓库压缩包下载和本地缓存，将API请求从每次扫描2-20次降低到首次1次，后续0次。

**Architecture:**
- 下载仓库zipball到本地缓存目录（`~/.agent-skills-guard/cache/{owner}_{repo}/`）
- 解压到本地文件系统
- 使用walkdir扫描本地文件系统而非GitHub API
- 数据库记录缓存路径和元数据

**Tech Stack:**
- zip crate（解压缩）
- walkdir（已有，本地目录遍历）
- reqwest（已有，HTTP下载）
- rusqlite（已有，数据库）

---

## Task 1: 添加依赖和数据库迁移

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/services/database.rs:31-87`
- Modify: `src-tauri/src/models/repository.rs:6-16`

**Step 1: 添加zip依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 部分添加：

```toml
# ZIP解压
zip = "2.2"
```

**Step 2: 运行cargo check验证依赖**

```bash
cd src-tauri
cargo check
```

Expected: 成功编译，下载zip crate

**Step 3: 扩展Repository模型**

在 `src-tauri/src/models/repository.rs` 中，修改 `Repository` 结构体：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repository {
    pub id: String,
    pub url: String,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub scan_subdirs: bool,
    pub added_at: DateTime<Utc>,
    pub last_scanned: Option<DateTime<Utc>>,
    // 新增：缓存相关字段
    pub cache_path: Option<String>,
    pub cached_at: Option<DateTime<Utc>>,
    pub cached_commit_sha: Option<String>,
}
```

同时更新 `new()` 方法：

```rust
pub fn new(url: String, name: String) -> Self {
    Self {
        id: uuid::Uuid::new_v4().to_string(),
        url,
        name,
        description: None,
        enabled: true,
        scan_subdirs: true,
        added_at: Utc::now(),
        last_scanned: None,
        cache_path: None,
        cached_at: None,
        cached_commit_sha: None,
    }
}
```

**Step 4: 添加数据库迁移**

在 `src-tauri/src/services/database.rs` 的 `initialize_schema()` 方法中，在执行迁移的部分添加新的迁移调用：

```rust
// 执行数据库迁移
self.migrate_add_repository_owner()?;
self.migrate_add_cache_fields()?;  // 新增
```

然后在文件末尾添加新的迁移方法：

```rust
/// 数据库迁移：添加缓存相关字段
fn migrate_add_cache_fields(&self) -> Result<()> {
    let conn = self.conn.lock().unwrap();

    // 添加 cache_path 列
    let _ = conn.execute(
        "ALTER TABLE repositories ADD COLUMN cache_path TEXT",
        [],
    );

    // 添加 cached_at 列
    let _ = conn.execute(
        "ALTER TABLE repositories ADD COLUMN cached_at TEXT",
        [],
    );

    // 添加 cached_commit_sha 列
    let _ = conn.execute(
        "ALTER TABLE repositories ADD COLUMN cached_commit_sha TEXT",
        [],
    );

    Ok(())
}
```

**Step 5: 运行应用验证迁移**

```bash
cargo run
```

Expected: 应用启动成功，数据库迁移执行

**Step 6: 提交**

```bash
git add Cargo.toml src-tauri/Cargo.toml src-tauri/src/models/repository.rs src-tauri/src/services/database.rs
git commit -m "feat: add zip dependency and cache fields to repository model"
```

---

## Task 2: 实现压缩包下载功能

**Files:**
- Modify: `src-tauri/src/services/github.rs:1-30`
- Modify: `src-tauri/src/services/github.rs:305+` (文件末尾添加新方法)

**Step 1: 添加必要的imports**

在 `src-tauri/src/services/github.rs` 顶部添加：

```rust
use std::path::{Path, PathBuf};
use std::fs::{self, File};
use std::io::Write;
use zip::ZipArchive;
```

**Step 2: 实现download_repository_archive方法**

在 `GitHubService` 实现块的末尾添加：

```rust
/// 下载仓库压缩包并解压到本地缓存
pub async fn download_repository_archive(
    &self,
    owner: &str,
    repo: &str,
    cache_base_dir: &Path,
) -> Result<PathBuf> {
    // 1. 创建仓库专属缓存目录
    let repo_cache_dir = cache_base_dir.join(format!("{}_{}", owner, repo));
    fs::create_dir_all(&repo_cache_dir)
        .context("无法创建缓存目录")?;

    // 2. 下载压缩包
    let url = format!("{}/repos/{}/{}/zipball/main", self.api_base, owner, repo);
    log::info!("正在下载仓库压缩包: {}", url);

    let response = self.client.get(&url).send().await
        .context("下载压缩包失败")?;

    // 检查API限流
    self.check_rate_limit(&response)?;

    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "下载失败，HTTP状态码: {}",
            response.status()
        ));
    }

    // 3. 保存压缩包到本地
    let archive_path = repo_cache_dir.join("archive.zip");
    let bytes = response.bytes().await
        .context("读取压缩包内容失败")?;

    let mut file = File::create(&archive_path)
        .context("无法创建压缩包文件")?;
    file.write_all(&bytes)
        .context("写入压缩包失败")?;

    log::info!("压缩包已保存: {:?}, 大小: {} bytes", archive_path, bytes.len());

    // 4. 解压缩
    let extract_dir = repo_cache_dir.join("extracted");
    self.extract_zip(&archive_path, &extract_dir)
        .context("解压缩失败")?;

    log::info!("解压完成: {:?}", extract_dir);

    Ok(extract_dir)
}
```

**Step 3: 实现extract_zip方法**

继续在同一个实现块中添加：

```rust
/// 解压zip文件
fn extract_zip(&self, archive_path: &Path, extract_dir: &Path) -> Result<()> {
    let file = File::open(archive_path)
        .context("无法打开压缩包")?;

    let mut archive = ZipArchive::new(file)
        .context("无法读取ZIP文件")?;

    log::info!("正在解压 {} 个文件...", archive.len());

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .context(format!("无法读取ZIP条目 {}", i))?;

        // GitHub的zipball会在根目录包含一个 {owner}-{repo}-{commit}/ 的文件夹
        // 我们需要提取这个路径
        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath)
                .context(format!("无法创建目录: {:?}", outpath))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .context(format!("无法创建父目录: {:?}", parent))?;
            }

            let mut outfile = File::create(&outpath)
                .context(format!("无法创建文件: {:?}", outpath))?;

            std::io::copy(&mut file, &mut outfile)
                .context(format!("无法写入文件: {:?}", outpath))?;
        }
    }

    Ok(())
}
```

**Step 4: 添加check_rate_limit辅助方法**

如果该方法不存在，在文件中添加（通常在fetch_directory_contents中已经有类似逻辑，需要提取出来）：

```rust
/// 检查GitHub API限流状态
fn check_rate_limit(&self, response: &reqwest::Response) -> Result<()> {
    if let Some(remaining) = response.headers().get("x-ratelimit-remaining") {
        if let Ok(remaining_str) = remaining.to_str() {
            log::debug!("GitHub API剩余配额: {}", remaining_str);

            if remaining_str == "0" {
                if let Some(reset) = response.headers().get("x-ratelimit-reset") {
                    if let Ok(reset_str) = reset.to_str() {
                        if let Ok(reset_timestamp) = reset_str.parse::<i64>() {
                            let now = chrono::Utc::now().timestamp();
                            let wait_seconds = reset_timestamp - now;
                            let wait_minutes = (wait_seconds + 59) / 60;

                            return Err(anyhow::anyhow!(
                                "GitHub API 速率限制已达上限，请等待约 {} 分钟后重试。\n\n提示：未认证的请求限制为每小时60次，认证后可提升至5000次/小时。",
                                wait_minutes
                            ));
                        }
                    }
                }
            }
        }
    }
    Ok(())
}
```

**Step 5: 运行cargo check验证**

```bash
cd src-tauri
cargo check
```

Expected: 编译成功，无错误

**Step 6: 提交**

```bash
git add src-tauri/src/services/github.rs
git commit -m "feat: implement repository archive download and extraction"
```

---

## Task 3: 实现本地缓存扫描功能

**Files:**
- Modify: `src-tauri/src/services/github.rs:305+` (继续添加新方法)

**Step 1: 实现scan_cached_repository方法**

在 `GitHubService` 实现块中添加：

```rust
/// 从本地缓存扫描skills（不需要API请求）
pub fn scan_cached_repository(
    &self,
    cache_path: &Path,
    repo_url: &str,
    scan_subdirs: bool,
) -> Result<Vec<Skill>> {
    use walkdir::WalkDir;

    let mut skills = Vec::new();
    let max_depth = if scan_subdirs { 10 } else { 2 };

    log::info!("开始扫描本地缓存: {:?}, scan_subdirs: {}", cache_path, scan_subdirs);

    // GitHub zipball的根目录是 {owner}-{repo}-{commit}/
    // 需要找到这个根目录
    let root_dir = self.find_repo_root(cache_path)?;

    log::info!("找到仓库根目录: {:?}", root_dir);

    // 遍历本地文件系统
    for entry in WalkDir::new(&root_dir)
        .max_depth(max_depth)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            // 检查是否包含SKILL.md
            let skill_md_path = entry.path().join("SKILL.md");
            if skill_md_path.exists() {
                log::info!("发现skill: {:?}", entry.path());

                // 读取并解析SKILL.md
                match self.parse_skill_from_file(&skill_md_path, entry.path(), &root_dir, repo_url) {
                    Ok(skill) => skills.push(skill),
                    Err(e) => log::warn!("解析skill失败 {:?}: {}", entry.path(), e),
                }
            }
        }
    }

    log::info!("本地扫描完成，发现 {} 个skills", skills.len());

    Ok(skills)
}

/// 找到GitHub zipball解压后的根目录
fn find_repo_root(&self, extract_dir: &Path) -> Result<PathBuf> {
    // GitHub zipball解压后会有一个 {owner}-{repo}-{commit}/ 目录
    // 我们需要找到这个目录
    for entry in fs::read_dir(extract_dir)
        .context("无法读取解压目录")?
    {
        let entry = entry.context("无法读取目录条目")?;
        if entry.file_type()?.is_dir() {
            return Ok(entry.path());
        }
    }

    Err(anyhow::anyhow!("未找到仓库根目录"))
}

/// 从本地SKILL.md文件解析skill信息
fn parse_skill_from_file(
    &self,
    skill_md_path: &Path,
    skill_dir: &Path,
    repo_root: &Path,
    repo_url: &str,
) -> Result<Skill> {
    // 读取SKILL.md内容
    let content = fs::read_to_string(skill_md_path)
        .context("无法读取SKILL.md")?;

    // 解析frontmatter获取name和description
    let (name, description) = self.parse_skill_frontmatter(&content)?;

    // 计算相对于仓库根目录的路径
    let relative_path = skill_dir.strip_prefix(repo_root)
        .context("无法计算相对路径")?;

    let file_path = relative_path.to_string_lossy().to_string();

    // 计算checksum
    let checksum = self.calculate_checksum(&content);

    let mut skill = Skill::new(name, repo_url.to_string(), file_path);
    skill.description = description;
    skill.checksum = Some(checksum);

    Ok(skill)
}

/// 计算文件内容的SHA256 checksum
fn calculate_checksum(&self, content: &str) -> String {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let result = hasher.finalize();

    hex::encode(result)
}
```

**Step 2: 运行cargo check验证**

```bash
cd src-tauri
cargo check
```

Expected: 编译成功

**Step 3: 提交**

```bash
git add src-tauri/src/services/github.rs
git commit -m "feat: implement local cache scanning for skills"
```

---

## Task 4: 添加数据库缓存管理方法

**Files:**
- Modify: `src-tauri/src/services/database.rs:400+` (文件末尾添加新方法)

**Step 1: 实现update_repository_cache方法**

在 `Database` 实现块的末尾添加：

```rust
/// 更新仓库缓存信息
pub fn update_repository_cache(
    &self,
    repo_id: &str,
    cache_path: &str,
    cached_at: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    let conn = self.conn.lock().unwrap();

    conn.execute(
        "UPDATE repositories
         SET cache_path = ?1, cached_at = ?2, last_scanned = ?3
         WHERE id = ?4",
        params![
            cache_path,
            cached_at.to_rfc3339(),
            cached_at.to_rfc3339(),
            repo_id,
        ],
    )?;

    Ok(())
}

/// 清除仓库缓存信息（但不删除文件）
pub fn clear_repository_cache_metadata(&self, repo_id: &str) -> Result<()> {
    let conn = self.conn.lock().unwrap();

    conn.execute(
        "UPDATE repositories
         SET cache_path = NULL, cached_at = NULL
         WHERE id = ?1",
        params![repo_id],
    )?;

    Ok(())
}

/// 获取单个仓库信息
pub fn get_repository(&self, repo_id: &str) -> Result<Option<Repository>> {
    let conn = self.conn.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, url, name, description, enabled, scan_subdirs,
                added_at, last_scanned, cache_path, cached_at, cached_commit_sha
         FROM repositories
         WHERE id = ?1"
    )?;

    let repo = stmt.query_row(params![repo_id], |row| {
        Ok(Repository {
            id: row.get(0)?,
            url: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            enabled: row.get::<_, i32>(4)? != 0,
            scan_subdirs: row.get::<_, i32>(5)? != 0,
            added_at: row.get::<_, String>(6)?.parse().unwrap_or_else(|_| chrono::Utc::now()),
            last_scanned: row.get::<_, Option<String>>(7)?
                .and_then(|s| s.parse().ok()),
            cache_path: row.get(8)?,
            cached_at: row.get::<_, Option<String>>(9)?
                .and_then(|s| s.parse().ok()),
            cached_commit_sha: row.get(10)?,
        })
    }).optional()?;

    Ok(repo)
}
```

**Step 2: 更新get_repositories方法以包含缓存字段**

找到现有的 `get_repositories` 方法并更新SQL查询和字段映射：

```rust
pub fn get_repositories(&self) -> Result<Vec<Repository>> {
    let conn = self.conn.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, url, name, description, enabled, scan_subdirs,
                added_at, last_scanned, cache_path, cached_at, cached_commit_sha
         FROM repositories
         ORDER BY added_at DESC"
    )?;

    let repos = stmt.query_map([], |row| {
        Ok(Repository {
            id: row.get(0)?,
            url: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            enabled: row.get::<_, i32>(4)? != 0,
            scan_subdirs: row.get::<_, i32>(5)? != 0,
            added_at: row.get::<_, String>(6)?.parse().unwrap_or_else(|_| chrono::Utc::now()),
            last_scanned: row.get::<_, Option<String>>(7)?
                .and_then(|s| s.parse().ok()),
            cache_path: row.get(8)?,
            cached_at: row.get::<_, Option<String>>(9)?
                .and_then(|s| s.parse().ok()),
            cached_commit_sha: row.get(10)?,
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(repos)
}
```

**Step 3: 运行cargo check验证**

```bash
cd src-tauri
cargo check
```

Expected: 编译成功

**Step 4: 提交**

```bash
git add src-tauri/src/services/database.rs
git commit -m "feat: add database methods for cache management"
```

---

## Task 5: 修改scan_repository命令使用缓存逻辑

**Files:**
- Modify: `src-tauri/src/commands/mod.rs:46-71`

**Step 1: 更新scan_repository命令实现**

替换现有的 `scan_repository` 命令：

```rust
/// 扫描仓库中的 skills
#[tauri::command]
pub async fn scan_repository(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<Skill>, String> {
    use chrono::Utc;

    // 获取仓库信息
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "仓库不存在".to_string())?;

    let (owner, repo_name) = Repository::from_github_url(&repo.url)
        .map_err(|e| e.to_string())?;

    // 确定缓存基础目录
    let cache_base_dir = dirs::cache_dir()
        .ok_or("无法获取缓存目录".to_string())?
        .join("agent-skills-guard")
        .join("repositories");

    let skills = if let Some(cache_path) = &repo.cache_path {
        // 使用缓存扫描（0次API请求）
        log::info!("使用本地缓存扫描仓库: {}", repo.name);

        let cache_path_buf = std::path::PathBuf::from(cache_path);
        if cache_path_buf.exists() {
            state.github.scan_cached_repository(&cache_path_buf, &repo.url, repo.scan_subdirs)
                .map_err(|e| format!("扫描缓存失败: {}", e))?
        } else {
            // 缓存路径不存在，重新下载
            log::warn!("缓存路径不存在，重新下载: {:?}", cache_path_buf);
            let extract_dir = state.github
                .download_repository_archive(&owner, &repo_name, &cache_base_dir)
                .await
                .map_err(|e| format!("下载仓库压缩包失败: {}", e))?;

            // 更新数据库缓存信息
            state.db.update_repository_cache(
                &repo_id,
                &extract_dir.to_string_lossy(),
                Utc::now(),
            ).map_err(|e| e.to_string())?;

            state.github.scan_cached_repository(&extract_dir, &repo.url, repo.scan_subdirs)
                .map_err(|e| format!("扫描缓存失败: {}", e))?
        }
    } else {
        // 首次扫描：下载压缩包并缓存（1次API请求）
        log::info!("首次扫描，下载仓库压缩包: {}", repo.name);

        let extract_dir = state.github
            .download_repository_archive(&owner, &repo_name, &cache_base_dir)
            .await
            .map_err(|e| format!("下载仓库压缩包失败: {}", e))?;

        // 更新数据库缓存信息
        state.db.update_repository_cache(
            &repo_id,
            &extract_dir.to_string_lossy(),
            Utc::now(),
        ).map_err(|e| e.to_string())?;

        // 扫描本地缓存
        state.github.scan_cached_repository(&extract_dir, &repo.url, repo.scan_subdirs)
            .map_err(|e| format!("扫描缓存失败: {}", e))?
    };

    // 保存到数据库
    for skill in &skills {
        state.db.save_skill(skill)
            .map_err(|e| e.to_string())?;
    }

    Ok(skills)
}
```

**Step 2: 运行cargo check验证**

```bash
cd src-tauri
cargo check
```

Expected: 编译成功

**Step 3: 运行应用测试扫描功能**

```bash
cargo run
```

在应用中：
1. 添加一个GitHub仓库（如 https://github.com/anthropics/claude-skills）
2. 点击"扫描"按钮
3. 观察日志输出

Expected:
- 第一次扫描：下载压缩包、解压、扫描本地文件
- 显示找到的skills列表
- 日志显示"首次扫描，下载仓库压缩包"

**Step 4: 测试缓存功能**

在应用中再次点击"扫描"按钮

Expected:
- 第二次扫描：直接使用缓存，不下载
- 日志显示"使用本地缓存扫描仓库"
- skills列表相同

**Step 5: 提交**

```bash
git add src-tauri/src/commands/mod.rs
git commit -m "feat: update scan_repository to use archive cache"
```

---

## Task 6: 添加缓存管理命令

**Files:**
- Modify: `src-tauri/src/commands/mod.rs:100+` (添加新命令)
- Modify: `src-tauri/src/lib.rs` (注册新命令)

**Step 1: 实现clear_repository_cache命令**

在 `src-tauri/src/commands/mod.rs` 末尾添加：

```rust
/// 清理指定仓库的缓存
#[tauri::command]
pub async fn clear_repository_cache(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<(), String> {
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or("仓库不存在")?;

    if let Some(cache_path) = &repo.cache_path {
        let cache_path_buf = std::path::PathBuf::from(cache_path);

        // 删除整个仓库缓存目录（包括archive.zip和extracted/）
        if let Some(parent) = cache_path_buf.parent() {
            if parent.exists() {
                std::fs::remove_dir_all(parent)
                    .map_err(|e| format!("删除缓存目录失败: {}", e))?;

                log::info!("已删除缓存目录: {:?}", parent);
            }
        }

        // 清除数据库中的缓存信息
        state.db.clear_repository_cache_metadata(&repo_id)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 刷新仓库缓存（清理后重新扫描）
#[tauri::command]
pub async fn refresh_repository_cache(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<Skill>, String> {
    // 先清理缓存
    clear_repository_cache(state.clone(), repo_id.clone()).await?;

    // 重新扫描（会自动下载新版本）
    scan_repository(state, repo_id).await
}

/// 获取缓存统计信息
#[tauri::command]
pub async fn get_cache_stats(
    state: State<'_, AppState>,
) -> Result<CacheStats, String> {
    let repos = state.db.get_repositories()
        .map_err(|e| e.to_string())?;

    let mut total_cached = 0;
    let mut total_size: u64 = 0;

    for repo in &repos {
        if let Some(cache_path) = &repo.cache_path {
            if let Some(parent) = std::path::PathBuf::from(cache_path).parent() {
                if parent.exists() {
                    total_cached += 1;

                    // 计算目录大小
                    if let Ok(size) = dir_size(parent) {
                        total_size += size;
                    }
                }
            }
        }
    }

    Ok(CacheStats {
        total_repositories: repos.len(),
        cached_repositories: total_cached,
        total_size_bytes: total_size,
    })
}

/// 计算目录大小
fn dir_size(path: &std::path::Path) -> Result<u64, std::io::Error> {
    use walkdir::WalkDir;

    let mut size = 0;

    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            size += entry.metadata()?.len();
        }
    }

    Ok(size)
}

/// 缓存统计信息
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub total_repositories: usize,
    pub cached_repositories: usize,
    pub total_size_bytes: u64,
}
```

**Step 2: 注册新命令到Tauri**

在 `src-tauri/src/lib.rs` 中找到 `.invoke_handler` 部分，添加新命令：

```rust
.invoke_handler(tauri::generate_handler![
    commands::add_repository,
    commands::get_repositories,
    commands::delete_repository,
    commands::scan_repository,
    commands::get_skills,
    commands::get_installed_skills,
    commands::install_skill,
    commands::uninstall_skill,
    commands::clear_repository_cache,      // 新增
    commands::refresh_repository_cache,    // 新增
    commands::get_cache_stats,             // 新增
])
```

**Step 3: 运行cargo check验证**

```bash
cd src-tauri
cargo check
```

Expected: 编译成功

**Step 4: 提交**

```bash
git add src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add cache management commands"
```

---

## Task 7: 更新前端API和类型定义

**Files:**
- Modify: `src/lib/api.ts`
- Create: `src/types/cache.ts`

**Step 1: 创建缓存类型定义**

创建 `src/types/cache.ts`:

```typescript
export interface CacheStats {
  totalRepositories: number;
  cachedRepositories: number;
  totalSizeBytes: number;
}

export interface Repository {
  id: string;
  url: string;
  name: string;
  description?: string;
  enabled: boolean;
  scanSubdirs: boolean;
  addedAt: string;
  lastScanned?: string;
  // 新增：缓存字段
  cachePath?: string;
  cachedAt?: string;
  cachedCommitSha?: string;
}
```

**Step 2: 更新API客户端**

在 `src/lib/api.ts` 中添加新的API方法：

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { CacheStats } from '../types/cache';

// 在现有的api对象中添加新方法
export const api = {
  // ... 现有方法 ...

  // 缓存管理
  clearRepositoryCache: (repoId: string): Promise<void> =>
    invoke('clear_repository_cache', { repoId }),

  refreshRepositoryCache: (repoId: string): Promise<Skill[]> =>
    invoke('refresh_repository_cache', { repoId }),

  getCacheStats: (): Promise<CacheStats> =>
    invoke('get_cache_stats'),
};
```

**Step 3: 运行pnpm typecheck验证**

```bash
pnpm typecheck
```

Expected: 类型检查通过

**Step 4: 提交**

```bash
git add src/lib/api.ts src/types/cache.ts
git commit -m "feat: add cache management API and types"
```

---

## Task 8: 更新前端UI显示缓存状态

**Files:**
- Modify: `src/components/RepositoriesPage.tsx`

**Step 1: 添加缓存状态显示**

在 `RepositoriesPage.tsx` 中，找到仓库列表项的渲染部分，添加缓存状态指示：

```typescript
{/* 仓库信息部分 */}
<div className="repo-info">
  <h3>{repo.name}</h3>
  <p className="repo-url">{repo.url}</p>

  {/* 新增：缓存状态 */}
  <div className="repo-status">
    {repo.cachePath ? (
      <span className="badge badge-success">
        ✓ 已缓存 {repo.cachedAt && `· ${formatDate(repo.cachedAt)}`}
      </span>
    ) : (
      <span className="badge badge-info">未缓存</span>
    )}
  </div>
</div>
```

**Step 2: 添加缓存管理按钮**

在仓库操作按钮部分添加缓存管理选项：

```typescript
{/* 操作按钮 */}
<div className="repo-actions">
  <button onClick={() => scanMutation.mutate(repo.id)}>
    扫描
  </button>

  {/* 新增：缓存管理按钮 */}
  {repo.cachePath && (
    <>
      <button
        onClick={() => handleRefreshCache(repo.id)}
        title="刷新缓存（重新下载）"
      >
        刷新缓存
      </button>
      <button
        onClick={() => handleClearCache(repo.id)}
        className="danger"
        title="清理本地缓存"
      >
        清理缓存
      </button>
    </>
  )}
</div>
```

**Step 3: 添加处理函数**

在组件中添加缓存管理的处理函数：

```typescript
const clearCacheMutation = useMutation({
  mutationFn: api.clearRepositoryCache,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    showToast('缓存已清理');
  },
  onError: (error: any) => {
    showToast(`清理失败: ${error.message || error}`);
  },
});

const refreshCacheMutation = useMutation({
  mutationFn: api.refreshRepositoryCache,
  onSuccess: (skills) => {
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    queryClient.invalidateQueries({ queryKey: ['skills'] });
    showToast(`缓存已刷新，发现 ${skills.length} 个skills`);
  },
  onError: (error: any) => {
    showToast(`刷新失败: ${error.message || error}`);
  },
});

const handleClearCache = (repoId: string) => {
  if (confirm('确定要清理此仓库的缓存吗？下次扫描将重新下载。')) {
    clearCacheMutation.mutate(repoId);
  }
};

const handleRefreshCache = (repoId: string) => {
  refreshCacheMutation.mutate(repoId);
};
```

**Step 4: 添加全局缓存统计显示**

在页面顶部添加缓存统计信息：

```typescript
const { data: cacheStats } = useQuery({
  queryKey: ['cache-stats'],
  queryFn: api.getCacheStats,
  refetchInterval: 30000, // 每30秒刷新
});

// 在页面顶部渲染
{cacheStats && (
  <div className="cache-stats">
    <h3>缓存统计</h3>
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-label">总仓库数</span>
        <span className="stat-value">{cacheStats.totalRepositories}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">已缓存</span>
        <span className="stat-value">{cacheStats.cachedRepositories}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">缓存大小</span>
        <span className="stat-value">{formatBytes(cacheStats.totalSizeBytes)}</span>
      </div>
    </div>
  </div>
)}
```

**Step 5: 添加辅助函数**

```typescript
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN');
}
```

**Step 6: 运行开发服务器测试**

```bash
pnpm dev
```

在浏览器中测试：
1. 查看缓存状态显示
2. 测试刷新缓存按钮
3. 测试清理缓存按钮
4. 验证缓存统计信息

Expected: UI正常显示，按钮功能正常

**Step 7: 提交**

```bash
git add src/components/RepositoriesPage.tsx
git commit -m "feat: add cache status display and management UI"
```

---

## Task 9: 添加样式优化

**Files:**
- Modify: `src/components/RepositoriesPage.tsx` (添加CSS)

**Step 1: 添加缓存相关样式**

在 `RepositoriesPage.tsx` 的样式部分添加：

```css
.cache-stats {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.cache-stats h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.repo-status {
  margin-top: 0.5rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-success {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.badge-info {
  background: rgba(59, 130, 246, 0.1);
  color: rgb(59, 130, 246);
}

.repo-actions button.danger {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
}

.repo-actions button.danger:hover {
  background: rgba(239, 68, 68, 0.2);
}
```

**Step 2: 验证样式**

```bash
pnpm dev
```

Expected: 缓存状态显示美观，样式一致

**Step 3: 提交**

```bash
git add src/components/RepositoriesPage.tsx
git commit -m "style: add cache status styling"
```

---

## Task 10: 端到端测试和文档

**Files:**
- Create: `docs/cache-usage.md`
- Modify: `README.md`

**Step 1: 端到端测试**

完整测试流程：

1. 启动应用：`pnpm tauri dev`
2. 添加仓库：https://github.com/anthropics/claude-skills
3. 首次扫描：
   - 观察日志："首次扫描，下载仓库压缩包"
   - 验证缓存目录创建：`~/.cache/agent-skills-guard/repositories/anthropics_claude-skills/`
   - 验证skills列表显示
   - 验证"已缓存"标记显示
4. 再次扫描：
   - 观察日志："使用本地缓存扫描仓库"
   - 验证扫描速度快（无需下载）
5. 刷新缓存：
   - 点击"刷新缓存"按钮
   - 观察重新下载
6. 清理缓存：
   - 点击"清理缓存"按钮
   - 验证"未缓存"状态
   - 再次扫描会重新下载

Expected: 所有功能正常工作

**Step 2: 创建使用文档**

创建 `docs/cache-usage.md`:

```markdown
# 仓库缓存功能使用指南

## 功能概述

仓库缓存功能通过下载GitHub仓库的压缩包到本地，大幅减少API请求次数：

- **首次扫描**: 1次API请求（下载压缩包）
- **后续扫描**: 0次API请求（使用本地缓存）
- **API节省**: 相比传统方式节省90%以上的请求

## 缓存位置

- **Windows**: `C:\Users\<用户名>\AppData\Local\agent-skills-guard\cache\repositories\`
- **macOS**: `~/Library/Caches/agent-skills-guard/repositories/`
- **Linux**: `~/.cache/agent-skills-guard/repositories/`

每个仓库的缓存结构：
```
{owner}_{repo}/
├── archive.zip        # 原始压缩包
└── extracted/         # 解压后的内容
    └── {owner}-{repo}-{commit}/
        └── ...        # 仓库文件
```

## 使用方法

### 扫描仓库

点击"扫描"按钮：
- 如果有缓存：直接使用缓存，瞬间完成
- 如果无缓存：下载压缩包，首次较慢

### 刷新缓存

点击"刷新缓存"按钮：
- 清除旧缓存
- 重新下载最新版本
- 用于更新仓库内容

### 清理缓存

点击"清理缓存"按钮：
- 删除本地缓存文件
- 释放磁盘空间
- 下次扫描会重新下载

## 缓存统计

页面顶部显示：
- 总仓库数
- 已缓存仓库数
- 缓存总大小

## 最佳实践

1. **定期刷新**: 每周刷新一次缓存，获取最新更新
2. **空间管理**: 定期检查缓存大小，清理不需要的仓库
3. **离线使用**: 缓存后可离线扫描和安装skills

## 故障排除

### 缓存损坏

如果扫描失败，尝试：
1. 点击"清理缓存"
2. 重新扫描

### 磁盘空间不足

清理不常用仓库的缓存，或删除整个缓存目录后重新扫描。
```

**Step 3: 更新README**

在 `README.md` 中添加缓存功能说明：

```markdown
## 功能特性

- ✅ GitHub仓库skills扫描和管理
- ✅ **本地缓存优化** - 首次下载，后续0次API请求
- ✅ Skills安装和卸载
- ✅ 安全扫描（可选）
- ✅ 多仓库支持

### 缓存功能

通过下载仓库压缩包到本地，显著减少GitHub API使用：

- 首次扫描：1次API请求
- 后续扫描：0次API请求
- API节省：90%以上

详见 [缓存使用指南](docs/cache-usage.md)
```

**Step 4: 提交**

```bash
git add docs/cache-usage.md README.md
git commit -m "docs: add cache feature documentation"
```

---

## 完成检查清单

在所有任务完成后，验证：

- [ ] 依赖正确添加（zip crate）
- [ ] 数据库迁移成功执行
- [ ] 首次扫描下载并缓存仓库
- [ ] 后续扫描使用缓存，无API请求
- [ ] 刷新缓存功能正常
- [ ] 清理缓存功能正常
- [ ] 缓存统计显示准确
- [ ] UI显示缓存状态
- [ ] 所有TypeScript类型检查通过
- [ ] 端到端测试通过
- [ ] 文档完整

## 后续优化（可选）

1. 添加缓存过期检查（基于时间）
2. 实现阶段2：更新检测功能
3. 添加进度条显示下载进度
4. 支持手动设置缓存目录
5. 添加缓存压缩功能节省空间
