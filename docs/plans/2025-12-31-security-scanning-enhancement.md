# 安全扫描功能增强实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 增强 agent-skills-guard 的安全扫描能力，将安全扫描作为首页，实现安装前强制扫描和手动触发扫描功能。

**架构:** 渐进式增强现有 Rust 规则系统，扩展检测规则库，使用现有 SQLite 数据库存储扫描结果，前端新增 SecurityDashboard 首页组件，在 Marketplace 安装流程中集成扫描门禁。

**技术栈:** Rust (规则引擎), rusqlite (数据库), React + TypeScript (前端), Tauri (桥接), TanStack Query (状态管理)

---

## 阶段 1: 规则库增强

### 任务 1.1: 扩展 PatternRule 结构体

**文件:**
- Modify: `src-tauri/src/security/rules.rs:26-37`

**步骤 1: 添加新字段到 PatternRule**

在 `PatternRule` 结构体中添加新字段：

```rust
/// 置信度等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Confidence {
    High,    // 高置信度，误报可能性低
    Medium,  // 中等置信度
    Low,     // 低置信度，可能误报
}

/// 危险模式规则
#[derive(Debug, Clone)]
pub struct PatternRule {
    pub id: &'static str,
    pub name: &'static str,
    pub pattern: Regex,
    pub severity: Severity,
    pub category: Category,
    pub weight: i32,
    pub description: &'static str,
    pub hard_trigger: bool,
    pub confidence: Confidence,           // 新增
    pub remediation: &'static str,        // 新增：修复建议
    pub cwe_id: Option<&'static str>,     // 新增：CWE 编号
}
```

**步骤 2: 更新 PatternRule::new 方法**

```rust
impl PatternRule {
    fn new(
        id: &'static str,
        name: &'static str,
        pattern: &'static str,
        severity: Severity,
        category: Category,
        weight: i32,
        description: &'static str,
        hard_trigger: bool,
        confidence: Confidence,
        remediation: &'static str,
        cwe_id: Option<&'static str>,
    ) -> Self {
        Self {
            id,
            name,
            pattern: Regex::new(pattern).expect("Invalid regex pattern"),
            severity,
            category,
            weight,
            description,
            hard_trigger,
            confidence,
            remediation,
            cwe_id,
        }
    }
}
```

**步骤 3: 运行测试确保编译通过**

```bash
cd src-tauri && cargo check
```

预期输出：错误，因为现有规则定义需要更新

**步骤 4: 提交**

```bash
git add src-tauri/src/security/rules.rs
git commit -m "feat(security): extend PatternRule with confidence, remediation, and cwe_id fields"
```

---

### 任务 1.2: 更新现有规则定义

**文件:**
- Modify: `src-tauri/src/security/rules.rs:63-349`

**步骤 1: 更新第一个规则作为示例**

将 RM_RF_ROOT 规则更新为：

```rust
PatternRule::new(
    "RM_RF_ROOT",
    "删除根目录",
    r"rm\s+(-[a-zA-Z]*)*\s*-r[a-zA-Z]*\s+(-[a-zA-Z]*\s+)*/($|\s|;|\|)",
    Severity::Critical,
    Category::Destructive,
    100,
    "rm -rf / 删除根目录",
    true,
    Confidence::High,
    "移除删除根目录的命令，使用更安全的删除方式",
    Some("CWE-78"),
),
```

**步骤 2: 批量更新所有现有规则**

更新所有规则定义，为每个规则添加：
- `confidence` 字段（根据规则特征判断）
- `remediation` 字段（提供修复建议）
- `cwe_id` 字段（如适用）

参考 CWE 映射：
- 命令注入: CWE-78
- 代码注入: CWE-94
- 敏感信息泄露: CWE-798
- 权限提升: CWE-269

**步骤 3: 运行测试**

```bash
cd src-tauri && cargo test security::rules
```

预期输出：所有测试通过

**步骤 4: 提交**

```bash
git add src-tauri/src/security/rules.rs
git commit -m "refactor(security): update all existing rules with confidence, remediation, and CWE IDs"
```

---

### 任务 1.3: 添加文件系统访问检测规则

**文件:**
- Modify: `src-tauri/src/security/rules.rs` (在 PATTERN_RULES 向量中添加)

**步骤 1: 添加敏感文件读取规则**

在 Category 枚举中添加新类别：

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Category {
    Destructive,
    RemoteExec,
    CmdInjection,
    Network,
    Privilege,
    Secrets,
    Persistence,
    SensitiveFileAccess,  // 新增
}
```

添加文件访问规则：

```rust
// H. 敏感文件访问
PatternRule::new(
    "SSH_PRIVATE_KEY_READ",
    "读取SSH私钥",
    r"(cat|less|more|head|tail|open|read).*\.ssh/(id_rsa|id_ed25519|id_ecdsa)",
    Severity::Critical,
    Category::SensitiveFileAccess,
    85,
    "尝试读取 SSH 私钥文件",
    true,
    Confidence::High,
    "移除对 SSH 私钥的访问，使用授权的密钥管理方式",
    Some("CWE-522"),
),
PatternRule::new(
    "AWS_CREDENTIALS_READ",
    "读取AWS凭证",
    r"(cat|less|more|head|tail|open|read).*\.aws/credentials",
    Severity::Critical,
    Category::SensitiveFileAccess,
    85,
    "尝试读取 AWS 凭证文件",
    true,
    Confidence::High,
    "移除对 AWS 凭证的直接访问，使用 IAM 角色或环境变量",
    Some("CWE-522"),
),
PatternRule::new(
    "ENV_FILE_READ",
    "读取环境变量文件",
    r"(cat|less|more|head|tail|open|read).*\.env",
    Severity::High,
    Category::SensitiveFileAccess,
    70,
    "尝试读取 .env 文件",
    false,
    Confidence::Medium,
    "确保 .env 文件只包含非敏感配置，敏感数据使用密钥管理服务",
    Some("CWE-522"),
),
PatternRule::new(
    "PASSWD_FILE_READ",
    "读取系统密码文件",
    r"(cat|less|more|head|tail|open|read).*/etc/(passwd|shadow)",
    Severity::Critical,
    Category::SensitiveFileAccess,
    90,
    "尝试读取系统密码文件",
    true,
    Confidence::High,
    "移除对系统密码文件的访问",
    Some("CWE-200"),
),
```

**步骤 2: 更新 scanner.rs 中的 map_category 方法**

```rust
fn map_category(&self, category: &Category) -> IssueCategory {
    match category {
        Category::Destructive => IssueCategory::FileSystem,
        Category::RemoteExec => IssueCategory::ProcessExecution,
        Category::CmdInjection => IssueCategory::DangerousFunction,
        Category::Network => IssueCategory::Network,
        Category::Privilege => IssueCategory::ProcessExecution,
        Category::Secrets => IssueCategory::DataExfiltration,
        Category::Persistence => IssueCategory::ProcessExecution,
        Category::SensitiveFileAccess => IssueCategory::FileSystem,  // 新增
    }
}
```

**步骤 3: 添加测试用例**

在 `src-tauri/src/security/scanner.rs` 的测试模块中添加：

```rust
#[test]
fn test_sensitive_file_access_detection() {
    let scanner = SecurityScanner::new();

    let content = r#"
---
name: Sensitive File Access Test
---
```bash
cat ~/.ssh/id_rsa
cat ~/.aws/credentials
cat /etc/passwd
```
"#;

    let report = scanner.scan_file(content, "test.md").unwrap();

    assert!(report.blocked, "Should be blocked due to sensitive file access");
    assert!(report.score < 50, "Score should be very low");
}
```

**步骤 4: 运行测试**

```bash
cd src-tauri && cargo test test_sensitive_file_access_detection
```

预期输出：PASS

**步骤 5: 提交**

```bash
git add src-tauri/src/security/rules.rs src-tauri/src/security/scanner.rs
git commit -m "feat(security): add sensitive file access detection rules"
```

---

### 任务 1.4: 添加更多网络和命令注入规则

**文件:**
- Modify: `src-tauri/src/security/rules.rs`

**步骤 1: 添加 Node.js 命令执行规则**

```rust
// 增强命令注入检测
PatternRule::new(
    "NODE_CHILD_PROCESS_EXEC",
    "Node.js child_process.exec",
    r"child_process\.(exec|execSync)\s*\(",
    Severity::High,
    Category::CmdInjection,
    65,
    "Node.js child_process.exec() 可能存在命令注入",
    false,
    Confidence::Medium,
    "使用 execFile 或 spawn 并传递数组参数，避免 shell 解析",
    Some("CWE-78"),
),
PatternRule::new(
    "NODE_VM_RUN",
    "Node.js vm.runInNewContext",
    r"vm\.runInNewContext\s*\(",
    Severity::High,
    Category::CmdInjection,
    70,
    "Node.js vm.runInNewContext() 动态代码执行",
    false,
    Confidence::High,
    "避免执行用户提供的代码，使用安全的 JSON 解析或配置",
    Some("CWE-94"),
),
```

**步骤 2: 添加网络外传检测规则**

```rust
// 增强网络检测
PatternRule::new(
    "SUSPICIOUS_DOMAIN",
    "可疑域名访问",
    r"(http|https|ftp)://(?!.*\b(api\.anthropic\.com|github\.com|githubusercontent\.com|pypi\.org|npmjs\.org)\b)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    Severity::Medium,
    Category::Network,
    30,
    "访问非白名单域名",
    false,
    Confidence::Low,
    "确认域名可信，或添加到白名单",
    None,
),
PatternRule::new(
    "WEBSOCKET_CONNECTION",
    "WebSocket 连接",
    r"(WebSocket|ws://|wss://)",
    Severity::Medium,
    Category::Network,
    35,
    "建立 WebSocket 连接",
    false,
    Confidence::Medium,
    "确认 WebSocket 端点可信，使用加密连接 (wss://)",
    None,
),
```

**步骤 3: 添加 JWT 和数据库凭证检测**

```rust
// 增强敏感信息检测
PatternRule::new(
    "JWT_TOKEN",
    "JWT Token 硬编码",
    r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}",
    Severity::Critical,
    Category::Secrets,
    75,
    "硬编码的 JWT Token",
    false,
    Confidence::High,
    "移除硬编码 Token，使用环境变量或密钥管理服务",
    Some("CWE-798"),
),
PatternRule::new(
    "DB_CONNECTION_STRING",
    "数据库连接串",
    r"(mysql|postgresql|mongodb|redis)://[^:]+:[^@]+@",
    Severity::High,
    Category::Secrets,
    70,
    "硬编码的数据库连接串",
    false,
    Confidence::High,
    "使用环境变量存储数据库凭证",
    Some("CWE-798"),
),
```

**步骤 4: 运行完整测试套件**

```bash
cd src-tauri && cargo test
```

预期输出：所有测试通过

**步骤 5: 提交**

```bash
git add src-tauri/src/security/rules.rs
git commit -m "feat(security): add Node.js, network, and credential detection rules"
```

---

## 阶段 2: 数据库扩展

### 任务 2.1: 添加数据库迁移函数

**文件:**
- Modify: `src-tauri/src/services/database.rs:268-291`

**步骤 1: 添加迁移函数**

在 `impl Database` 块中添加新的迁移函数：

```rust
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
```

**步骤 2: 在 initialize_schema 中调用迁移**

在 `initialize_schema` 方法的末尾添加：

```rust
fn initialize_schema(&self) -> Result<()> {
    // ... 现有代码 ...

    // 执行数据库迁移
    self.migrate_add_repository_owner()?;
    self.migrate_add_cache_fields()?;
    self.migrate_add_security_enhancement_fields()?;  // 新增

    Ok(())
}
```

**步骤 3: 运行测试**

```bash
cd src-tauri && cargo test database
```

预期输出：所有测试通过

**步骤 4: 提交**

```bash
git add src-tauri/src/services/database.rs
git commit -m "feat(database): add migration for security enhancement fields"
```

---

### 任务 2.2: 更新 Skill 模型

**文件:**
- Modify: `src-tauri/src/models/skill.rs`

**步骤 1: 添加新字段到 Skill 结构体**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub repository_url: String,
    pub repository_owner: Option<String>,
    pub file_path: String,
    pub version: Option<String>,
    pub author: Option<String>,
    pub installed: bool,
    pub installed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub local_path: Option<String>,
    pub checksum: Option<String>,
    pub security_score: Option<i32>,
    pub security_issues: Option<Vec<SecurityIssue>>,
    pub security_level: Option<String>,                        // 新增
    pub scanned_at: Option<chrono::DateTime<chrono::Utc>>,    // 新增
}
```

**步骤 2: 更新数据库保存逻辑**

在 `database.rs` 的 `save_skill` 方法中更新：

```rust
pub fn save_skill(&self, skill: &Skill) -> Result<()> {
    let conn = self.conn.lock().unwrap();

    let security_issues_json = skill.security_issues.as_ref()
        .map(|issues| serde_json::to_string(issues).unwrap());

    conn.execute(
        "INSERT OR REPLACE INTO skills
        (id, name, description, repository_url, repository_owner, file_path, version, author,
         installed, installed_at, local_path, checksum, security_score, security_issues,
         security_level, scanned_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
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
            skill.checksum,
            skill.security_score,
            security_issues_json,
            skill.security_level,                                    // 新增
            skill.scanned_at.as_ref().map(|d| d.to_rfc3339()),      // 新增
        ],
    )?;

    Ok(())
}
```

**步骤 3: 更新数据库读取逻辑**

在 `get_skills` 方法中更新：

```rust
pub fn get_skills(&self) -> Result<Vec<Skill>> {
    let conn = self.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, name, description, repository_url, repository_owner, file_path, version, author,
                installed, installed_at, local_path, checksum, security_score, security_issues,
                security_level, scanned_at
         FROM skills"
    )?;

    let skills = stmt.query_map([], |row| {
        let security_issues: Option<String> = row.get(13)?;
        let security_issues = security_issues
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
            checksum: row.get(11)?,
            security_score: row.get(12)?,
            security_issues,
            security_level: row.get(14)?,                           // 新增
            scanned_at: row.get::<_, Option<String>>(15)?          // 新增
                .and_then(|s| s.parse().ok()),
        })
    })?
    .collect::<Result<Vec<_>, _>>()?;

    Ok(skills)
}
```

**步骤 4: 运行测试**

```bash
cd src-tauri && cargo test
```

预期输出：所有测试通过

**步骤 5: 提交**

```bash
git add src-tauri/src/models/skill.rs src-tauri/src/services/database.rs
git commit -m "feat(models): add security_level and scanned_at fields to Skill"
```

---

## 阶段 3: 后端 API

### 任务 3.1: 添加 SecurityLevel 枚举和 SkillScanResult 类型

**文件:**
- Modify: `src-tauri/src/models/security.rs`

**步骤 1: 添加 SecurityLevel 枚举**

```rust
/// 安全等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SecurityLevel {
    Safe,      // 90-100
    Low,       // 70-89
    Medium,    // 50-69
    High,      // 30-49
    Critical,  // 0-29
}

impl SecurityLevel {
    pub fn from_score(score: i32) -> Self {
        match score {
            90..=100 => SecurityLevel::Safe,
            70..=89 => SecurityLevel::Low,
            50..=69 => SecurityLevel::Medium,
            30..=49 => SecurityLevel::High,
            _ => SecurityLevel::Critical,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SecurityLevel::Safe => "Safe",
            SecurityLevel::Low => "Low",
            SecurityLevel::Medium => "Medium",
            SecurityLevel::High => "High",
            SecurityLevel::Critical => "Critical",
        }
    }
}
```

**步骤 2: 添加 SkillScanResult 结构体**

```rust
/// Skill 扫描结果（用于前端展示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillScanResult {
    pub skill_id: String,
    pub skill_name: String,
    pub score: i32,
    pub level: String,
    pub scanned_at: String,
    pub report: SecurityReport,
}
```

**步骤 3: 运行测试**

```bash
cd src-tauri && cargo check
```

预期输出：编译通过

**步骤 4: 提交**

```bash
git add src-tauri/src/models/security.rs
git commit -m "feat(models): add SecurityLevel enum and SkillScanResult type"
```

---

### 任务 3.2: 实现扫描所有已安装 skills 命令

**文件:**
- Create: `src-tauri/src/commands/security.rs`
- Modify: `src-tauri/src/commands/mod.rs`

**步骤 1: 创建 security commands 模块**

创建新文件 `src-tauri/src/commands/security.rs`:

```rust
use crate::models::security::{SecurityReport, SkillScanResult, SecurityLevel};
use crate::models::Skill;
use crate::security::scanner::SecurityScanner;
use crate::services::database::Database;
use anyhow::Result;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

/// 扫描所有已安装的 skills
#[tauri::command]
pub async fn scan_all_installed_skills(
    app_handle: tauri::AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = db.get_skills().map_err(|e| e.to_string())?;
    let installed_skills: Vec<Skill> = skills.into_iter()
        .filter(|s| s.installed && s.local_path.is_some())
        .collect();

    let scanner = SecurityScanner::new();
    let mut results = Vec::new();

    for mut skill in installed_skills {
        if let Some(local_path) = &skill.local_path {
            let skill_file_path = PathBuf::from(local_path);

            if let Ok(content) = std::fs::read_to_string(&skill_file_path) {
                match scanner.scan_file(&content, &skill.id) {
                    Ok(report) => {
                        // 更新 skill 的安全信息
                        skill.security_score = Some(report.score);
                        skill.security_level = Some(report.level.as_str().to_string());
                        skill.security_issues = Some(report.issues.clone());
                        skill.scanned_at = Some(chrono::Utc::now());

                        // 保存到数据库
                        let _ = db.save_skill(&skill);

                        results.push(SkillScanResult {
                            skill_id: skill.id.clone(),
                            skill_name: skill.name.clone(),
                            score: report.score,
                            level: report.level.as_str().to_string(),
                            scanned_at: chrono::Utc::now().to_rfc3339(),
                            report,
                        });
                    }
                    Err(e) => {
                        eprintln!("Failed to scan skill {}: {}", skill.name, e);
                    }
                }
            }
        }
    }

    Ok(results)
}

/// 获取缓存的扫描结果
#[tauri::command]
pub async fn get_scan_results(
    db: State<'_, Arc<Database>>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = db.get_skills().map_err(|e| e.to_string())?;

    let results: Vec<SkillScanResult> = skills.into_iter()
        .filter(|s| s.installed && s.security_score.is_some())
        .map(|s| {
            let report = SecurityReport {
                skill_id: s.id.clone(),
                score: s.security_score.unwrap_or(0),
                level: SecurityLevel::from_score(s.security_score.unwrap_or(0)),
                issues: s.security_issues.clone().unwrap_or_default(),
                recommendations: vec![],
                blocked: false,
                hard_trigger_issues: vec![],
            };

            SkillScanResult {
                skill_id: s.id.clone(),
                skill_name: s.name.clone(),
                score: s.security_score.unwrap_or(0),
                level: s.security_level.clone().unwrap_or_else(|| "Unknown".to_string()),
                scanned_at: s.scanned_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                report,
            }
        })
        .collect();

    Ok(results)
}
```

**步骤 2: 在 mod.rs 中导出**

修改 `src-tauri/src/commands/mod.rs`:

```rust
pub mod security;

// ... 现有代码 ...
```

**步骤 3: 在 lib.rs 中注册命令**

修改 `src-tauri/src/lib.rs`:

```rust
use commands::security::{scan_all_installed_skills, get_scan_results};

// 在 tauri::Builder 中添加
.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    scan_all_installed_skills,
    get_scan_results,
])
```

**步骤 4: 运行测试**

```bash
cd src-tauri && cargo build
```

预期输出：编译成功

**步骤 5: 提交**

```bash
git add src-tauri/src/commands/security.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(commands): add scan_all_installed_skills and get_scan_results commands"
```

---

### 任务 3.3: 实现扫描归档文件命令

**文件:**
- Modify: `src-tauri/src/commands/security.rs`

**步骤 1: 添加 scan_skill_archive 命令**

```rust
/// 扫描单个 skill 归档文件（用于安装前检查）
#[tauri::command]
pub async fn scan_skill_archive(
    archive_path: String,
) -> Result<SecurityReport, String> {
    let scanner = SecurityScanner::new();

    // 读取归档文件内容
    // 注意：这里假设归档已经解压到临时目录，传入的是 SKILL.md 文件路径
    let content = std::fs::read_to_string(&archive_path)
        .map_err(|e| format!("Failed to read skill file: {}", e))?;

    let report = scanner.scan_file(&content, &archive_path)
        .map_err(|e| format!("Failed to scan skill: {}", e))?;

    Ok(report)
}
```

**步骤 2: 在 lib.rs 中注册命令**

```rust
use commands::security::{scan_all_installed_skills, get_scan_results, scan_skill_archive};

.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    scan_all_installed_skills,
    get_scan_results,
    scan_skill_archive,  // 新增
])
```

**步骤 3: 运行测试**

```bash
cd src-tauri && cargo build
```

预期输出：编译成功

**步骤 4: 提交**

```bash
git add src-tauri/src/commands/security.rs src-tauri/src/lib.rs
git commit -m "feat(commands): add scan_skill_archive command for pre-installation scanning"
```

---

## 阶段 4: 前端界面

### 任务 4.1: 创建 SecurityDashboard 组件

**文件:**
- Create: `src/components/SecurityDashboard.tsx`

**步骤 1: 创建基础组件结构**

```typescript
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SkillScanResult {
  skill_id: string;
  skill_name: string;
  score: number;
  level: string;
  scanned_at: string;
  report: SecurityReport;
}

interface SecurityReport {
  skill_id: string;
  score: number;
  level: string;
  issues: SecurityIssue[];
  recommendations: string[];
  blocked: boolean;
  hard_trigger_issues: string[];
}

interface SecurityIssue {
  severity: string;
  category: string;
  description: string;
  line_number?: number;
  code_snippet?: string;
}

export function SecurityDashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "name" | "time">("score");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillScanResult | null>(null);

  // 获取缓存的扫描结果
  const { data: scanResults = [], isLoading } = useQuery<SkillScanResult[]>({
    queryKey: ["scanResults"],
    queryFn: async () => {
      return await invoke("get_scan_results");
    },
  });

  // 触发扫描
  const handleScan = async () => {
    setIsScanning(true);
    try {
      await invoke("scan_all_installed_skills");
      queryClient.invalidateQueries({ queryKey: ["scanResults"] });
    } catch (error) {
      console.error("Scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-terminal-cyan">
            {t('security.title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('security.subtitle')}
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="px-4 py-2 bg-terminal-cyan text-background font-mono rounded hover:bg-terminal-cyan/90 disabled:opacity-50 flex items-center gap-2"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('security.scanning')}
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              {t('security.scanAll')}
            </>
          )}
        </button>
      </div>

      {/* TODO: 后续步骤添加过滤栏和列表 */}
    </div>
  );
}
```

**步骤 2: 添加国际化文本**

在 `src/i18n/locales/zh.json` 中添加：

```json
{
  "security": {
    "title": "安全扫描",
    "subtitle": "查看和管理 Skills 的安全状态",
    "scanAll": "扫描所有 Skills",
    "scanning": "扫描中...",
    "lastScan": "上次扫描",
    "totalSkills": "总计 Skills"
  }
}
```

在 `src/i18n/locales/en.json` 中添加：

```json
{
  "security": {
    "title": "Security Scan",
    "subtitle": "View and manage security status of Skills",
    "scanAll": "Scan All Skills",
    "scanning": "Scanning...",
    "lastScan": "Last Scan",
    "totalSkills": "Total Skills"
  }
}
```

**步骤 3: 运行开发服务器测试**

```bash
pnpm dev
```

预期结果：页面加载，但还没有完整内容

**步骤 4: 提交**

```bash
git add src/components/SecurityDashboard.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(ui): create SecurityDashboard base component"
```

---

### 任务 4.2: 添加过滤和排序栏

**文件:**
- Modify: `src/components/SecurityDashboard.tsx`

**步骤 1: 添加过滤排序栏 UI**

在 `SecurityDashboard` 组件中，在 "TODO" 注释处添加：

```typescript
{/* 过滤和排序栏 */}
<div className="flex flex-wrap items-center gap-4 p-4 bg-card/30 rounded-lg border border-border">
  {/* 风险等级过滤 */}
  <div className="flex items-center gap-2">
    <label className="text-sm font-mono text-muted-foreground">
      {t('security.filterByLevel')}:
    </label>
    <select
      value={filterLevel}
      onChange={(e) => setFilterLevel(e.target.value)}
      className="px-3 py-1 bg-background border border-border rounded font-mono text-sm"
    >
      <option value="all">{t('security.levels.all')}</option>
      <option value="Critical">{t('security.levels.critical')}</option>
      <option value="High">{t('security.levels.high')}</option>
      <option value="Medium">{t('security.levels.medium')}</option>
      <option value="Low">{t('security.levels.low')}</option>
      <option value="Safe">{t('security.levels.safe')}</option>
    </select>
  </div>

  {/* 排序选项 */}
  <div className="flex items-center gap-2">
    <label className="text-sm font-mono text-muted-foreground">
      {t('security.sortBy')}:
    </label>
    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value as any)}
      className="px-3 py-1 bg-background border border-border rounded font-mono text-sm"
    >
      <option value="score">{t('security.sort.score')}</option>
      <option value="name">{t('security.sort.name')}</option>
      <option value="time">{t('security.sort.time')}</option>
    </select>
  </div>

  {/* 搜索框 */}
  <div className="flex-1 min-w-[200px]">
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('security.search')}
        className="w-full pl-10 pr-4 py-1 bg-background border border-border rounded font-mono text-sm"
      />
    </div>
  </div>
</div>
```

**步骤 2: 实现过滤和排序逻辑**

在组件中添加：

```typescript
// 过滤和排序
const filteredAndSortedResults = scanResults
  .filter((result) => {
    // 等级过滤
    if (filterLevel !== "all" && result.level !== filterLevel) {
      return false;
    }
    // 搜索过滤
    if (searchQuery && !result.skill_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  })
  .sort((a, b) => {
    switch (sortBy) {
      case "score":
        return a.score - b.score; // 低分在前
      case "name":
        return a.skill_name.localeCompare(b.skill_name);
      case "time":
        return new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime();
      default:
        return 0;
    }
  });
```

**步骤 3: 添加国际化文本**

```json
{
  "security": {
    "filterByLevel": "风险等级",
    "sortBy": "排序",
    "search": "搜索 Skills...",
    "levels": {
      "all": "全部",
      "critical": "严重",
      "high": "高风险",
      "medium": "中风险",
      "low": "低风险",
      "safe": "安全"
    },
    "sort": {
      "score": "按评分",
      "name": "按名称",
      "time": "按扫描时间"
    }
  }
}
```

**步骤 4: 测试**

```bash
pnpm dev
```

预期结果：过滤和排序控件显示正常

**步骤 5: 提交**

```bash
git add src/components/SecurityDashboard.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(ui): add filtering and sorting controls to SecurityDashboard"
```

---

### 任务 4.3: 添加 Skills 列表表格

**文件:**
- Modify: `src/components/SecurityDashboard.tsx`

**步骤 1: 添加安全等级徽章组件**

```typescript
function SecurityBadge({ level }: { level: string }) {
  const colors = {
    Safe: "bg-green-500/20 text-green-500 border-green-500/50",
    Low: "bg-blue-500/20 text-blue-500 border-blue-500/50",
    Medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/50",
    High: "bg-orange-500/20 text-orange-500 border-orange-500/50",
    Critical: "bg-red-500/20 text-red-500 border-red-500/50",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-mono border ${colors[level as keyof typeof colors] || colors.Safe}`}>
      {level}
    </span>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const getColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <span className={`text-2xl font-bold font-mono ${getColor(score)}`}>
      {score}
    </span>
  );
}
```

**步骤 2: 添加表格 UI**

```typescript
{/* Skills 列表表格 */}
<div className="bg-card/30 rounded-lg border border-border overflow-hidden">
  {isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-terminal-cyan" />
    </div>
  ) : filteredAndSortedResults.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Shield className="w-12 h-12 mb-4" />
      <p className="font-mono">{t('security.noResults')}</p>
    </div>
  ) : (
    <table className="w-full">
      <thead className="bg-background/50 border-b border-border">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.skillName')}
          </th>
          <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.score')}
          </th>
          <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.level')}
          </th>
          <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.issues')}
          </th>
          <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.lastScan')}
          </th>
          <th className="px-6 py-3 text-center text-xs font-mono text-muted-foreground uppercase">
            {t('security.table.actions')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {filteredAndSortedResults.map((result) => (
          <tr key={result.skill_id} className="hover:bg-background/50 transition-colors">
            <td className="px-6 py-4 font-mono text-sm">
              {result.skill_name}
            </td>
            <td className="px-6 py-4 text-center">
              <ScoreDisplay score={result.score} />
            </td>
            <td className="px-6 py-4 text-center">
              <SecurityBadge level={result.level} />
            </td>
            <td className="px-6 py-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-mono">
                {result.report.issues.filter(i => i.severity === "Critical").length > 0 && (
                  <span className="text-red-500">C:{result.report.issues.filter(i => i.severity === "Critical").length}</span>
                )}
                {result.report.issues.filter(i => i.severity === "Error").length > 0 && (
                  <span className="text-orange-500">H:{result.report.issues.filter(i => i.severity === "Error").length}</span>
                )}
                {result.report.issues.filter(i => i.severity === "Warning").length > 0 && (
                  <span className="text-yellow-500">M:{result.report.issues.filter(i => i.severity === "Warning").length}</span>
                )}
              </div>
            </td>
            <td className="px-6 py-4 text-center text-xs font-mono text-muted-foreground">
              {new Date(result.scanned_at).toLocaleString()}
            </td>
            <td className="px-6 py-4 text-center">
              <button
                onClick={() => setSelectedSkill(result)}
                className="px-3 py-1 text-xs font-mono border border-terminal-cyan text-terminal-cyan rounded hover:bg-terminal-cyan/10"
              >
                {t('security.table.viewDetails')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
```

**步骤 3: 添加国际化文本**

```json
{
  "security": {
    "noResults": "未找到扫描结果",
    "table": {
      "skillName": "Skill 名称",
      "score": "安全评分",
      "level": "风险等级",
      "issues": "问题数量",
      "lastScan": "最后扫描",
      "actions": "操作",
      "viewDetails": "查看详情"
    }
  }
}
```

**步骤 4: 测试**

```bash
pnpm dev
```

预期结果：表格显示正常

**步骤 5: 提交**

```bash
git add src/components/SecurityDashboard.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(ui): add skills list table to SecurityDashboard"
```

---

### 任务 4.4: 创建详情对话框组件

**文件:**
- Create: `src/components/SecurityDetailDialog.tsx`

**步骤 1: 创建对话框组件**

```typescript
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Shield, AlertTriangle, Info } from "lucide-react";

interface SecurityDetailDialogProps {
  result: SkillScanResult | null;
  open: boolean;
  onClose: () => void;
}

export function SecurityDetailDialog({ result, open, onClose }: SecurityDetailDialogProps) {
  if (!result) return null;

  const { report } = result;

  // 按严重程度分组
  const criticalIssues = report.issues.filter(i => i.severity === "Critical");
  const highIssues = report.issues.filter(i => i.severity === "Error");
  const mediumIssues = report.issues.filter(i => i.severity === "Warning");
  const lowIssues = report.issues.filter(i => i.severity === "Info");

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-terminal-cyan" />
            <div>
              <div className="text-xl">{result.skill_name}</div>
              <div className="text-sm text-muted-foreground font-normal mt-1">
                扫描时间: {new Date(result.scanned_at).toLocaleString()}
              </div>
            </div>
          </AlertDialogTitle>
        </AlertDialogHeader>

        {/* 总体评分 */}
        <div className="flex items-center justify-between p-6 bg-card/50 rounded-lg border border-border">
          <div>
            <div className="text-sm text-muted-foreground mb-1">安全评分</div>
            <div className={`text-5xl font-bold font-mono ${
              result.score >= 90 ? 'text-green-500' :
              result.score >= 70 ? 'text-yellow-500' :
              result.score >= 50 ? 'text-orange-500' : 'text-red-500'
            }`}>
              {result.score}
            </div>
          </div>
          <div>
            <span className={`px-4 py-2 rounded-lg text-lg font-mono border ${
              result.level === 'Safe' ? 'bg-green-500/20 text-green-500 border-green-500/50' :
              result.level === 'Low' ? 'bg-blue-500/20 text-blue-500 border-blue-500/50' :
              result.level === 'Medium' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' :
              result.level === 'High' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' :
              'bg-red-500/20 text-red-500 border-red-500/50'
            }`}>
              {result.level}
            </span>
          </div>
        </div>

        {/* 问题列表 */}
        <div className="space-y-4">
          {criticalIssues.length > 0 && (
            <IssueSection
              title="严重问题"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              issues={criticalIssues}
              color="red"
            />
          )}

          {highIssues.length > 0 && (
            <IssueSection
              title="高风险问题"
              icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
              issues={highIssues}
              color="orange"
              defaultCollapsed
            />
          )}

          {mediumIssues.length > 0 && (
            <IssueSection
              title="中风险问题"
              icon={<Info className="w-5 h-5 text-yellow-500" />}
              issues={mediumIssues}
              color="yellow"
              defaultCollapsed
            />
          )}

          {lowIssues.length > 0 && (
            <IssueSection
              title="低风险问题"
              icon={<Info className="w-5 h-5 text-blue-500" />}
              issues={lowIssues}
              color="blue"
              defaultCollapsed
            />
          )}
        </div>

        {/* 建议区域 */}
        {report.recommendations.length > 0 && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
            <div className="font-mono text-sm font-bold mb-2">建议:</div>
            <ul className="space-y-1 text-sm">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-yellow-500">▸</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>关闭</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 问题区块组件
function IssueSection({
  title,
  icon,
  issues,
  color,
  defaultCollapsed = false
}: {
  title: string;
  icon: React.ReactNode;
  issues: any[];
  color: string;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={`border rounded-lg overflow-hidden border-${color}-500/50`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between p-4 bg-${color}-500/10 hover:bg-${color}-500/20 transition-colors`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono font-bold">{title}</span>
          <span className="text-sm text-muted-foreground">({issues.length})</span>
        </div>
        <span className="text-sm">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {issues.map((issue, idx) => (
            <div key={idx} className="p-3 bg-background/50 rounded border border-border">
              <div className="font-mono text-sm font-bold mb-2">{issue.description}</div>
              {issue.code_snippet && (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">
                    行号: {issue.line_number}
                  </div>
                  <pre className="p-2 bg-background rounded text-xs font-mono overflow-x-auto">
                    <code>{issue.code_snippet}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**步骤 2: 在 SecurityDashboard 中使用**

```typescript
import { SecurityDetailDialog } from "./SecurityDetailDialog";

// 在组件末尾添加
<SecurityDetailDialog
  result={selectedSkill}
  open={selectedSkill !== null}
  onClose={() => setSelectedSkill(null)}
/>
```

**步骤 3: 测试**

```bash
pnpm dev
```

预期结果：点击"查看详情"按钮打开详情对话框

**步骤 4: 提交**

```bash
git add src/components/SecurityDetailDialog.tsx src/components/SecurityDashboard.tsx
git commit -m "feat(ui): create SecurityDetailDialog component"
```

---

### 任务 4.5: 将 SecurityDashboard 设为首页

**文件:**
- Modify: `src/App.tsx`

**步骤 1: 导入 SecurityDashboard**

```typescript
import { SecurityDashboard } from "./components/SecurityDashboard";
```

**步骤 2: 修改默认 tab 为 security**

```typescript
const [currentTab, setCurrentTab] = useState<"security" | "installed" | "marketplace" | "repositories">("security");
```

**步骤 3: 添加 Security 导航标签**

在导航栏中添加 Security 标签（放在最前面）：

```typescript
<button
  onClick={() => setCurrentTab("security")}
  className={`
    relative px-6 py-3 font-mono text-sm font-medium transition-all duration-200
    ${currentTab === "security"
      ? "text-terminal-cyan border-b-2 border-terminal-cyan"
      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
    }
  `}
>
  <div className="flex items-center gap-2">
    <Shield className="w-4 h-4" />
    <span>{t('nav.security')}</span>
    {currentTab === "security" && (
      <span className="text-terminal-green">●</span>
    )}
  </div>
</button>
```

**步骤 4: 在主内容区添加路由**

```typescript
{currentTab === "security" && <SecurityDashboard />}
{currentTab === "installed" && <InstalledSkillsPage />}
{currentTab === "marketplace" && <MarketplacePage />}
{currentTab === "repositories" && <RepositoriesPage />}
```

**步骤 5: 移除启动时的自动扫描逻辑**

删除或注释掉 App.tsx 中的 `initLocalSkills` useEffect。

**步骤 6: 添加国际化**

```json
{
  "nav": {
    "security": "安全扫描",
    "installed": "已安装",
    "marketplace": "市场",
    "repositories": "仓库"
  }
}
```

**步骤 7: 测试**

```bash
pnpm dev
```

预期结果：应用打开后默认显示 Security 页面

**步骤 8: 提交**

```bash
git add src/App.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(ui): set SecurityDashboard as default homepage"
```

---

## 阶段 5: 安装门禁

### 任务 5.1: 在 MarketplacePage 安装流程中集成扫描

**文件:**
- Modify: `src/components/MarketplacePage.tsx`

**步骤 1: 创建安装确认对话框组件**

在文件末尾添加：

```typescript
interface InstallConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  report: SecurityReport | null;
  skillName: string;
}

function InstallConfirmDialog({
  open,
  onClose,
  onConfirm,
  report,
  skillName
}: InstallConfirmDialogProps) {
  if (!report) return null;

  const isSafe = report.score >= 70;
  const isMediumRisk = report.score >= 50 && report.score < 70;
  const isHighRisk = report.score < 50 || report.blocked;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isHighRisk ? (
              <XCircle className="w-6 h-6 text-red-500" />
            ) : isMediumRisk ? (
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            安全扫描结果
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div>
                准备安装: <span className="font-mono font-bold">{skillName}</span>
              </div>

              {/* 评分 */}
              <div className="flex items-center justify-between p-4 bg-card/50 rounded-lg">
                <span className="text-sm">安全评分:</span>
                <span className={`text-3xl font-bold font-mono ${
                  report.score >= 90 ? 'text-green-500' :
                  report.score >= 70 ? 'text-yellow-500' :
                  report.score >= 50 ? 'text-orange-500' : 'text-red-500'
                }`}>
                  {report.score}
                </span>
              </div>

              {/* 问题摘要 */}
              {report.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-bold">检测到的问题:</div>
                  <div className="flex gap-4 text-sm">
                    {report.issues.filter(i => i.severity === "Critical").length > 0 && (
                      <span className="text-red-500">
                        严重: {report.issues.filter(i => i.severity === "Critical").length}
                      </span>
                    )}
                    {report.issues.filter(i => i.severity === "Error").length > 0 && (
                      <span className="text-orange-500">
                        高风险: {report.issues.filter(i => i.severity === "Error").length}
                      </span>
                    )}
                    {report.issues.filter(i => i.severity === "Warning").length > 0 && (
                      <span className="text-yellow-500">
                        中风险: {report.issues.filter(i => i.severity === "Warning").length}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 建议 */}
              {report.recommendations.length > 0 && (
                <div className={`p-3 rounded-lg ${
                  isHighRisk ? 'bg-red-500/10 border border-red-500/50' :
                  isMediumRisk ? 'bg-yellow-500/10 border border-yellow-500/50' :
                  'bg-green-500/10 border border-green-500/50'
                }`}>
                  <ul className="space-y-1 text-sm">
                    {report.recommendations.slice(0, 3).map((rec, idx) => (
                      <li key={idx}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 警告信息 */}
              {isHighRisk && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-sm">
                  <strong>⚠️ 强烈建议不要安装此 Skill！</strong>
                  <br />
                  检测到严重安全威胁，可能危害您的系统或数据。
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>取消</AlertDialogCancel>
          {!report.blocked && (
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded font-mono ${
                isHighRisk ? 'bg-red-500 hover:bg-red-600' :
                isMediumRisk ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-green-500 hover:bg-green-600'
              } text-white`}
            >
              {isHighRisk ? '仍然安装' : isMediumRisk ? '谨慎安装' : '安装'}
            </button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**步骤 2: 修改安装逻辑，添加扫描步骤**

在 MarketplacePage 组件中，找到安装函数并修改：

```typescript
const [pendingInstall, setPendingInstall] = useState<{
  skill: Skill;
  report: SecurityReport;
} | null>(null);

const handleInstall = async (skill: Skill) => {
  try {
    setIsInstalling(skill.id);

    // 1. 下载到缓存
    await invoke("install_skill", {
      skillId: skill.id,
      repositoryUrl: skill.repository_url,
      filePath: skill.file_path,
    });

    // 2. 扫描归档文件
    const tempPath = `temp/skills/${skill.id}/SKILL.md`; // 根据实际路径调整
    const report = await invoke<SecurityReport>("scan_skill_archive", {
      archivePath: tempPath,
    });

    // 3. 根据评分决定
    if (report.score >= 70) {
      // 直接安装
      await finalizeInstall(skill);
    } else {
      // 显示确认对话框
      setPendingInstall({ skill, report });
    }
  } catch (error) {
    console.error("Installation failed:", error);
    // 错误处理
  } finally {
    setIsInstalling(null);
  }
};

const finalizeInstall = async (skill: Skill) => {
  // 完成实际安装
  // ... 现有安装逻辑 ...
  setPendingInstall(null);
};
```

**步骤 3: 添加对话框到 UI**

```typescript
<InstallConfirmDialog
  open={pendingInstall !== null}
  onClose={() => setPendingInstall(null)}
  onConfirm={() => pendingInstall && finalizeInstall(pendingInstall.skill)}
  report={pendingInstall?.report || null}
  skillName={pendingInstall?.skill.name || ""}
/>
```

**步骤 4: 测试**

```bash
pnpm dev
```

预期结果：安装 skill 时触发扫描，根据风险显示不同的确认对话框

**步骤 5: 提交**

```bash
git add src/components/MarketplacePage.tsx
git commit -m "feat(marketplace): integrate security scanning into installation flow"
```

---

## 阶段 6: 测试和优化

### 任务 6.1: 添加规则单元测试

**文件:**
- Modify: `src-tauri/src/security/scanner.rs` (测试模块)

**步骤 1: 添加新规则的测试用例**

```rust
#[test]
fn test_node_js_detection() {
    let scanner = SecurityScanner::new();

    let content = r#"
const { exec } = require('child_process');
exec('rm -rf /tmp/*');

const vm = require('vm');
vm.runInNewContext('process.exit()');
"#;

    let report = scanner.scan_file(content, "test.md").unwrap();

    assert!(report.score < 80, "Score should be reduced for Node.js risks");
    assert!(report.issues.len() >= 2, "Should detect exec and vm.runInNewContext");
}

#[test]
fn test_jwt_token_detection() {
    let scanner = SecurityScanner::new();

    let content = r#"
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
"#;

    let report = scanner.scan_file(content, "test.md").unwrap();

    assert!(report.score < 90, "Score should be reduced for hardcoded JWT");
    assert!(report.issues.iter().any(|i| i.description.contains("JWT")));
}

#[test]
fn test_database_credentials_detection() {
    let scanner = SecurityScanner::new();

    let content = r#"
const db = "mongodb://admin:password123@localhost:27017/mydb";
const redis = "redis://user:pass@redis-server:6379";
"#;

    let report = scanner.scan_file(content, "test.md").unwrap();

    assert!(report.score < 85, "Score should be reduced for DB credentials");
}
```

**步骤 2: 运行测试**

```bash
cd src-tauri && cargo test
```

预期输出：所有测试通过

**步骤 3: 提交**

```bash
git add src-tauri/src/security/scanner.rs
git commit -m "test(security): add tests for new detection rules"
```

---

### 任务 6.2: 性能优化 - 并行扫描

**文件:**
- Modify: `src-tauri/src/commands/security.rs`

**步骤 1: 使用 tokio 并行扫描**

```rust
use tokio::task;

#[tauri::command]
pub async fn scan_all_installed_skills(
    app_handle: tauri::AppHandle,
    db: State<'_, Arc<Database>>,
) -> Result<Vec<SkillScanResult>, String> {
    let skills = db.get_skills().map_err(|e| e.to_string())?;
    let installed_skills: Vec<Skill> = skills.into_iter()
        .filter(|s| s.installed && s.local_path.is_some())
        .collect();

    let db_clone = Arc::clone(&db);

    // 并行扫描
    let scan_tasks: Vec<_> = installed_skills.into_iter().map(|skill| {
        let db = Arc::clone(&db_clone);
        task::spawn(async move {
            if let Some(local_path) = &skill.local_path {
                let skill_file_path = PathBuf::from(local_path);

                if let Ok(content) = std::fs::read_to_string(&skill_file_path) {
                    let scanner = SecurityScanner::new();
                    if let Ok(report) = scanner.scan_file(&content, &skill.id) {
                        let mut updated_skill = skill.clone();
                        updated_skill.security_score = Some(report.score);
                        updated_skill.security_level = Some(report.level.as_str().to_string());
                        updated_skill.security_issues = Some(report.issues.clone());
                        updated_skill.scanned_at = Some(chrono::Utc::now());

                        let _ = db.save_skill(&updated_skill);

                        return Some(SkillScanResult {
                            skill_id: updated_skill.id.clone(),
                            skill_name: updated_skill.name.clone(),
                            score: report.score,
                            level: report.level.as_str().to_string(),
                            scanned_at: chrono::Utc::now().to_rfc3339(),
                            report,
                        });
                    }
                }
            }
            None
        })
    }).collect();

    // 等待所有任务完成
    let mut results = Vec::new();
    for task in scan_tasks {
        if let Ok(Some(result)) = task.await {
            results.push(result);
        }
    }

    Ok(results)
}
```

**步骤 2: 测试性能**

```bash
cd src-tauri && cargo build --release
```

**步骤 3: 提交**

```bash
git add src-tauri/src/commands/security.rs
git commit -m "perf(security): implement parallel scanning for better performance"
```

---

### 任务 6.3: 错误处理增强

**文件:**
- Modify: `src/components/SecurityDashboard.tsx`

**步骤 1: 添加错误状态处理**

```typescript
const [scanError, setScanError] = useState<string | null>(null);

const handleScan = async () => {
  setIsScanning(true);
  setScanError(null);
  try {
    await invoke("scan_all_installed_skills");
    queryClient.invalidateQueries({ queryKey: ["scanResults"] });
  } catch (error) {
    console.error("Scan failed:", error);
    setScanError(error instanceof Error ? error.message : "扫描失败");
  } finally {
    setIsScanning(false);
  }
};

// 在 UI 中显示错误
{scanError && (
  <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-2">
    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
    <div>
      <div className="font-bold text-red-500">扫描失败</div>
      <div className="text-sm text-muted-foreground">{scanError}</div>
    </div>
  </div>
)}
```

**步骤 2: 测试**

```bash
pnpm dev
```

**步骤 3: 提交**

```bash
git add src/components/SecurityDashboard.tsx
git commit -m "feat(ui): add error handling to SecurityDashboard"
```

---

### 任务 6.4: 文档和最终测试

**文件:**
- Create: `docs/security-scanning-usage.md`

**步骤 1: 编写使用文档**

```markdown
# 安全扫描功能使用指南

## 功能概述

安全扫描功能帮助您检测 Skills 中的潜在安全风险，包括：
- 破坏性操作
- 远程代码执行
- 命令注入
- 敏感信息泄露
- 网络数据外传

## 使用方法

### 1. 查看安全扫描首页

打开应用后，默认显示"安全扫描"页面，您可以看到：
- 所有已安装 Skills 的安全状态
- 安全评分（0-100 分）
- 风险等级（严重/高/中/低/安全）

### 2. 手动扫描

点击"扫描所有 Skills"按钮，触发完整扫描。

### 3. 查看详情

点击"查看详情"按钮，查看具体的安全问题：
- 代码片段
- 行号
- 修复建议

### 4. 安装前扫描

从 Marketplace 安装 Skill 时：
- 系统自动扫描
- 评分 ≥ 70：直接安装
- 评分 50-69：显示风险提示，可选择安装
- 评分 < 50：强烈建议不安装

## 风险等级说明

- **严重 (Critical)**: 0-29 分，极高风险
- **高 (High)**: 30-49 分，高风险
- **中 (Medium)**: 50-69 分，中等风险
- **低 (Low)**: 70-89 分，低风险
- **安全 (Safe)**: 90-100 分，安全
```

**步骤 2: 运行完整测试**

```bash
# 后端测试
cd src-tauri && cargo test

# 前端构建测试
cd .. && pnpm build

# Tauri 构建测试
pnpm tauri build
```

预期结果：所有测试通过，构建成功

**步骤 3: 提交**

```bash
git add docs/security-scanning-usage.md
git commit -m "docs: add security scanning usage guide"
```

---

## 最终验收

### 验收清单

- [ ] 规则库扩展到 40+ 条规则
- [ ] SecurityDashboard 作为首页显示
- [ ] 可以手动触发扫描
- [ ] Marketplace 安装时强制扫描
- [ ] 扫描结果持久化到数据库
- [ ] 详情对话框显示完整报告
- [ ] 过滤和排序功能正常
- [ ] 所有单元测试通过
- [ ] 前端构建成功
- [ ] Tauri 应用可以正常运行

### 最终提交

```bash
git add -A
git commit -m "feat: complete security scanning enhancement

完整实现安全扫描功能增强，包括：
- 规则库从 20 条扩展到 40+ 条
- SecurityDashboard 作为应用首页
- 手动触发扫描功能
- Marketplace 安装前强制扫描
- 详细的安全报告展示
- 并行扫描性能优化
- 完整的错误处理
- 使用文档

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
"
```

---

**实施说明:**

1. 按任务顺序逐步执行
2. 每个任务完成后立即测试和提交
3. 遇到问题及时记录和调整
4. 保持频繁提交，确保进度可追溯
5. 最终验收前完整测试所有功能
