use crate::models::{Plugin, Repository, Skill};
use anyhow::{Result, Context};
use rusqlite::{Connection, params, OptionalExtension};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// 创建或打开数据库
    pub fn new(db_path: PathBuf) -> Result<Self> {
        // 确保父目录存在
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(db_path)
            .context("Failed to open database")?;

        let db = Self {
            conn: Mutex::new(conn),
        };

        db.initialize_schema()?;
        Ok(db)
    }

    /// 重置数据库中的所有业务数据（保留表结构与迁移）
    pub fn reset_all_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            r#"
            PRAGMA foreign_keys=OFF;
            BEGIN IMMEDIATE;
            DELETE FROM installations;
            DELETE FROM plugins;
            DELETE FROM skills;
            DELETE FROM repositories;
            COMMIT;
            PRAGMA foreign_keys=ON;
            "#,
        )?;

        // 若启用了 WAL，尽量将 WAL 截断，避免残留旧页面
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

        // 尽量释放空间（不影响正确性）
        let _ = conn.execute_batch("VACUUM;");

        drop(conn);
        let _ = self.initialize_default_repositories()?;

        Ok(())
    }

    /// 初始化数据库架构
    fn initialize_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "CREATE TABLE IF NOT EXISTS repositories (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                scan_subdirs INTEGER NOT NULL DEFAULT 1,
                added_at TEXT NOT NULL,
                last_scanned TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                repository_url TEXT NOT NULL,
                repository_owner TEXT,
                file_path TEXT NOT NULL,
                version TEXT,
                author TEXT,
                installed INTEGER NOT NULL DEFAULT 0,
                installed_at TEXT,
                local_path TEXT,
                checksum TEXT,
                security_score INTEGER,
                security_issues TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                version TEXT,
                author TEXT,
                repository_url TEXT NOT NULL,
                repository_owner TEXT,
                marketplace_name TEXT NOT NULL,
                source TEXT NOT NULL,
                installed INTEGER NOT NULL DEFAULT 0,
                installed_at TEXT,
                security_score INTEGER,
                security_issues TEXT,
                security_level TEXT,
                scanned_at TEXT,
                staging_path TEXT,
                install_log TEXT,
                install_status TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS installations (
                skill_id TEXT PRIMARY KEY,
                installed_at TEXT NOT NULL,
                version TEXT NOT NULL,
                local_path TEXT NOT NULL,
                checksum TEXT NOT NULL,
                FOREIGN KEY(skill_id) REFERENCES skills(id)
            )",
            [],
        )?;

        // 释放锁以便调用迁移方法
        drop(conn);

        // 执行数据库迁移
        self.migrate_add_repository_owner()?;
        self.migrate_add_cache_fields()?;
        self.migrate_add_security_enhancement_fields()?;
        self.migrate_add_local_paths()?;
        self.migrate_add_installed_commit_sha()?;

        // 初始化默认仓库（忽略返回值，因为在这个阶段我们只是初始化数据库）
        let _ = self.initialize_default_repositories()?;

        Ok(())
    }

    /// 保存 plugin
    pub fn save_plugin(&self, plugin: &Plugin) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let security_issues_json = plugin.security_issues.as_ref()
            .map(|issues| serde_json::to_string(issues).unwrap());

        conn.execute(
            "INSERT OR REPLACE INTO plugins
            (id, name, description, version, author, repository_url, repository_owner, marketplace_name, source,
             installed, installed_at, security_score, security_issues, security_level, scanned_at, staging_path,
             install_log, install_status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                plugin.id,
                plugin.name,
                plugin.description,
                plugin.version,
                plugin.author,
                plugin.repository_url,
                plugin.repository_owner,
                plugin.marketplace_name,
                plugin.source,
                plugin.installed as i32,
                plugin.installed_at.as_ref().map(|d| d.to_rfc3339()),
                plugin.security_score,
                security_issues_json,
                plugin.security_level,
                plugin.scanned_at.as_ref().map(|d| d.to_rfc3339()),
                plugin.staging_path,
                plugin.install_log,
                plugin.install_status,
            ],
        )?;

        Ok(())
    }

    /// 数据库迁移：添加 repository_owner 列
    fn migrate_add_repository_owner(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 尝试添加列（如果列已存在会失败，这是正常的）
        let _ = conn.execute(
            "ALTER TABLE skills ADD COLUMN repository_owner TEXT",
            [],
        );

        // 为现有记录填充 repository_owner
        conn.execute(
            r#"
            UPDATE skills
            SET repository_owner = CASE
                WHEN repository_url = 'local' THEN 'local'
                WHEN repository_url LIKE '%github.com/%' THEN
                    substr(
                        repository_url,
                        instr(repository_url, 'github.com/') + 11,
                        CASE
                            WHEN instr(substr(repository_url, instr(repository_url, 'github.com/') + 11), '/') > 0
                            THEN instr(substr(repository_url, instr(repository_url, 'github.com/') + 11), '/') - 1
                            ELSE length(substr(repository_url, instr(repository_url, 'github.com/') + 11))
                        END
                    )
                ELSE 'unknown'
            END
            WHERE repository_owner IS NULL
            "#,
            [],
        )?;

        Ok(())
    }

    /// 添加仓库
    pub fn add_repository(&self, repo: &Repository) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "INSERT OR REPLACE INTO repositories
            (id, url, name, description, enabled, scan_subdirs, added_at, last_scanned, cache_path, cached_at, cached_commit_sha)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                repo.id,
                repo.url,
                repo.name,
                repo.description,
                repo.enabled as i32,
                repo.scan_subdirs as i32,
                repo.added_at.to_rfc3339(),
                repo.last_scanned.as_ref().map(|d| d.to_rfc3339()),
                repo.cache_path,
                repo.cached_at.as_ref().map(|d| d.to_rfc3339()),
                repo.cached_commit_sha,
            ],
        )?;

        Ok(())
    }

    /// 获取所有仓库
    pub fn get_repositories(&self) -> Result<Vec<Repository>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, url, name, description, enabled, scan_subdirs, added_at, last_scanned, cache_path, cached_at, cached_commit_sha
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

    /// 保存 skill
    pub fn save_skill(&self, skill: &Skill) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        let security_issues_json = skill.security_issues.as_ref()
            .map(|issues| serde_json::to_string(issues).unwrap());

        let local_paths_json = skill.local_paths.as_ref()
            .map(|paths| serde_json::to_string(paths).unwrap());

        conn.execute(
            "INSERT OR REPLACE INTO skills
            (id, name, description, repository_url, repository_owner, file_path, version, author,
             installed, installed_at, local_path, local_paths, checksum, security_score, security_issues, security_level, scanned_at, installed_commit_sha)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                skill.id,
                skill.name,
                skill.description,
                skill.repository_url,
                skill.repository_owner,
                skill.file_path,
                skill.version,
                skill.author,
                skill.installed as i32,
                skill.installed_at.as_ref().map(|d| d.to_rfc3339()),
                skill.local_path,
                local_paths_json,
                skill.checksum,
                skill.security_score,
                security_issues_json,
                skill.security_level,
                skill.scanned_at.as_ref().map(|d| d.to_rfc3339()),
                skill.installed_commit_sha,
            ],
        )?;

        Ok(())
    }

    /// 获取所有 skills
    pub fn get_skills(&self) -> Result<Vec<Skill>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, repository_url, repository_owner, file_path, version, author,
                    installed, installed_at, local_path, local_paths, checksum, security_score, security_issues, security_level, scanned_at, installed_commit_sha
             FROM skills"
        )?;

        let skills = stmt.query_map([], |row| {
            let security_issues: Option<String> = row.get(14)?;
            let security_issues = security_issues
                .and_then(|s| serde_json::from_str(&s).ok());

            let local_paths: Option<String> = row.get(11)?;
            let local_paths = local_paths
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                repository_url: row.get(3)?,
                repository_owner: row.get(4)?,
                file_path: row.get(5)?,
                version: row.get(6)?,
                author: row.get(7)?,
                installed: row.get::<_, i32>(8)? != 0,
                installed_at: row.get::<_, Option<String>>(9)?
                    .and_then(|s| s.parse().ok()),
                local_path: row.get(10)?,
                local_paths,
                checksum: row.get(12)?,
                security_score: row.get(13)?,
                security_issues,
                security_level: row.get(15)?,
                scanned_at: row.get::<_, Option<String>>(16)?
                    .and_then(|s| s.parse().ok()),
                installed_commit_sha: row.get(17)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(skills)
    }

    /// 获取所有 plugins
    pub fn get_plugins(&self) -> Result<Vec<Plugin>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, version, author, repository_url, repository_owner, marketplace_name, source,
                    installed, installed_at, security_score, security_issues, security_level, scanned_at, staging_path,
                    install_log, install_status
             FROM plugins"
        )?;

        let plugins = stmt.query_map([], |row| {
            let security_issues: Option<String> = row.get(12)?;
            let security_issues = security_issues
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Plugin {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                version: row.get(3)?,
                author: row.get(4)?,
                repository_url: row.get(5)?,
                repository_owner: row.get(6)?,
                marketplace_name: row.get(7)?,
                source: row.get(8)?,
                installed: row.get::<_, i32>(9)? != 0,
                installed_at: row.get::<_, Option<String>>(10)?
                    .and_then(|s| s.parse().ok()),
                security_score: row.get(11)?,
                security_issues,
                security_level: row.get(13)?,
                scanned_at: row.get::<_, Option<String>>(14)?
                    .and_then(|s| s.parse().ok()),
                staging_path: row.get(15)?,
                install_log: row.get(16)?,
                install_status: row.get(17)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(plugins)
    }

    /// 删除仓库
    pub fn delete_repository(&self, repo_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM repositories WHERE id = ?1", params![repo_id])?;
        Ok(())
    }

    /// 删除指定仓库的所有未安装技能
    pub fn delete_uninstalled_skills_by_repository_url(&self, repository_url: &str) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let deleted_count = conn.execute(
            "DELETE FROM skills WHERE repository_url = ?1 AND installed = 0",
            params![repository_url]
        )?;
        Ok(deleted_count)
    }

    /// 删除指定仓库的所有未安装插件
    pub fn delete_uninstalled_plugins_by_repository_url(&self, repository_url: &str) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let deleted_count = conn.execute(
            "DELETE FROM plugins WHERE repository_url = ?1 AND installed = 0",
            params![repository_url]
        )?;
        Ok(deleted_count)
    }

    /// 删除 skill
    pub fn delete_skill(&self, skill_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM skills WHERE id = ?1", params![skill_id])?;
        conn.execute("DELETE FROM installations WHERE skill_id = ?1", params![skill_id])?;
        Ok(())
    }

    /// 删除 plugin 记录
    pub fn delete_plugin(&self, plugin_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM plugins WHERE id = ?1", params![plugin_id])?;
        Ok(())
    }

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

    /// 数据库迁移：添加安全扫描增强字段
    fn migrate_add_security_enhancement_fields(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 添加 security_level 列
        let _ = conn.execute(
            "ALTER TABLE skills ADD COLUMN security_level TEXT",
            [],
        );

        // 添加 scanned_at 列
        let _ = conn.execute(
            "ALTER TABLE skills ADD COLUMN scanned_at TEXT",
            [],
        );

        Ok(())
    }

    /// 数据库迁移：添加 local_paths 列,支持多个安装路径
    fn migrate_add_local_paths(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 添加 local_paths 列（JSON 数组格式）
        let _ = conn.execute(
            "ALTER TABLE skills ADD COLUMN local_paths TEXT",
            [],
        );

        // 将现有的 local_path 迁移到 local_paths 数组中
        conn.execute(
            r#"
            UPDATE skills
            SET local_paths = json_array(local_path)
            WHERE local_path IS NOT NULL AND local_paths IS NULL
            "#,
            [],
        )?;

        Ok(())
    }

    /// 更新仓库缓存信息
    pub fn update_repository_cache(
        &self,
        repo_id: &str,
        cache_path: &str,
        cached_at: chrono::DateTime<chrono::Utc>,
        cached_commit_sha: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute(
            "UPDATE repositories
             SET cache_path = ?1, cached_at = ?2, last_scanned = ?3, cached_commit_sha = ?4
             WHERE id = ?5",
            params![
                cache_path,
                cached_at.to_rfc3339(),
                cached_at.to_rfc3339(),
                cached_commit_sha,
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
             SET cache_path = NULL, cached_at = NULL, cached_commit_sha = NULL
             WHERE id = ?1",
            params![repo_id],
        )?;

        Ok(())
    }

    /// 数据库迁移：添加 installed_commit_sha 列
    fn migrate_add_installed_commit_sha(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 添加 installed_commit_sha 列
        let _ = conn.execute(
            "ALTER TABLE skills ADD COLUMN installed_commit_sha TEXT",
            [],
        );

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

    /// 初始化默认仓库
    /// 返回是否添加了新仓库（用于判断是否需要自动扫描）
    fn initialize_default_repositories(&self) -> Result<bool> {
        let conn = self.conn.lock().unwrap();

        // 检查是否已有仓库
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM repositories",
            [],
            |row| row.get(0),
        )?;

        // 如果已有仓库，跳过初始化
        if count > 0 {
            return Ok(false);
        }

        // 添加默认仓库
        let default_repos = vec![
            (
                "https://github.com/anthropics/skills".to_string(),
                "anthropics".to_string(),
            ),
            (
                "https://github.com/obra/superpowers".to_string(),
                "obra".to_string(),
            ),
        ];

        // 释放之前的锁，重新获取锁用于插入操作
        drop(conn);
        let conn = self.conn.lock().unwrap();

        let mut added = false;
        for (url, name) in default_repos {
            let repo = Repository::new(url, name);
            // 使用 INSERT OR IGNORE 避免重复
            match conn.execute(
                "INSERT OR IGNORE INTO repositories
                (id, url, name, description, enabled, scan_subdirs, added_at, last_scanned, cache_path, cached_at, cached_commit_sha)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    repo.id,
                    repo.url,
                    repo.name,
                    repo.description,
                    repo.enabled as i32,
                    repo.scan_subdirs as i32,
                    repo.added_at.to_rfc3339(),
                    repo.last_scanned.as_ref().map(|d| d.to_rfc3339()),
                    repo.cache_path,
                    repo.cached_at.as_ref().map(|d| d.to_rfc3339()),
                    repo.cached_commit_sha,
                ],
            ) {
                Ok(rows_affected) => {
                    if rows_affected > 0 {
                        log::info!("成功添加默认仓库: {}", repo.name);
                        added = true;
                    }
                }
                Err(e) => {
                    log::warn!("添加默认仓库 {} 失败: {}", repo.name, e);
                    // 继续添加下一个仓库，不中断流程
                }
            }
        }

        Ok(added)
    }

    /// 获取所有未扫描的仓库ID列表
    pub fn get_unscanned_repositories(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id FROM repositories WHERE last_scanned IS NULL AND enabled = 1"
        )?;

        let repo_ids = stmt.query_map([], |row| {
            Ok(row.get(0)?)
        })?
        .collect::<std::result::Result<Vec<String>, _>>()?;

        Ok(repo_ids)
    }
}
