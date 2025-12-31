# 仓库更新检测与差异分析设计方案

## 一、功能概述

实现GitHub仓库的更新检测，当仓库有新commit时：
1. 自动检测更新（后台定时任务或手动触发）
2. 下载新版本到临时目录
3. 对比新旧版本的skills
4. 生成详细的变更报告
5. 在UI上显示更新提示和变更详情

## 二、实现架构

```rust
// src-tauri/src/models.rs

/// Skill变更类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SkillChangeType {
    Added,    // 新增
    Modified, // 修改
    Removed,  // 删除
}

/// Skill变更详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillChange {
    pub change_type: SkillChangeType,
    pub skill_name: String,
    pub skill_path: String,
    pub old_description: Option<String>,  // 修改前的描述
    pub new_description: Option<String>,  // 修改后的描述
    pub old_checksum: Option<String>,
    pub new_checksum: Option<String>,
}

/// 仓库更新信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryUpdate {
    pub id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub old_commit_sha: Option<String>,
    pub new_commit_sha: String,
    pub commit_message: Option<String>,  // 最新commit的消息
    pub commit_author: Option<String>,
    pub commit_date: Option<String>,
    pub checked_at: String,
    pub changes: Vec<SkillChange>,
    pub viewed: bool,
}

impl RepositoryUpdate {
    /// 统计变更数量
    pub fn count_changes(&self) -> (usize, usize, usize) {
        let mut added = 0;
        let mut modified = 0;
        let mut removed = 0;

        for change in &self.changes {
            match change.change_type {
                SkillChangeType::Added => added += 1,
                SkillChangeType::Modified => modified += 1,
                SkillChangeType::Removed => removed += 1,
            }
        }

        (added, modified, removed)
    }

    /// 是否有变更
    pub fn has_changes(&self) -> bool {
        !self.changes.is_empty()
    }
}
```

## 三、GitHub服务扩展

```rust
// src-tauri/src/services/github.rs

impl GitHubService {
    /// 获取仓库最新commit信息
    pub async fn get_latest_commit(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<CommitInfo> {
        let url = format!("{}/repos/{}/{}/commits/main", self.api_base, owner, repo);
        let response = self.client
            .get(&url)
            .send()
            .await?;

        self.check_rate_limit(&response)?;

        #[derive(Deserialize)]
        struct CommitResponse {
            sha: String,
            commit: CommitDetails,
        }

        #[derive(Deserialize)]
        struct CommitDetails {
            message: String,
            author: AuthorInfo,
        }

        #[derive(Deserialize)]
        struct AuthorInfo {
            name: String,
            date: String,
        }

        let commit: CommitResponse = response.json().await?;

        Ok(CommitInfo {
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commit.commit.author.date,
        })
    }

    /// 检查仓库是否有更新
    pub async fn check_repository_updates(
        &self,
        owner: &str,
        repo: &str,
        cached_commit_sha: Option<&str>,
    ) -> Result<Option<CommitInfo>> {
        let latest = self.get_latest_commit(owner, repo).await?;

        // 如果没有缓存的commit SHA，或者SHA不同，说明有更新
        if cached_commit_sha.is_none() || Some(latest.sha.as_str()) != cached_commit_sha {
            Ok(Some(latest))
        } else {
            Ok(None)
        }
    }

    /// 对比两个版本的skills，生成变更列表
    pub fn compare_skills(
        &self,
        old_skills: &[Skill],
        new_skills: &[Skill],
    ) -> Vec<SkillChange> {
        use std::collections::HashMap;

        let mut changes = Vec::new();

        // 创建旧版本的skill映射（以file_path为key）
        let old_map: HashMap<String, &Skill> = old_skills
            .iter()
            .map(|s| (s.file_path.clone(), s))
            .collect();

        // 创建新版本的skill映射
        let new_map: HashMap<String, &Skill> = new_skills
            .iter()
            .map(|s| (s.file_path.clone(), s))
            .collect();

        // 检测新增和修改
        for (path, new_skill) in &new_map {
            if let Some(old_skill) = old_map.get(path) {
                // 存在于旧版本，检查是否修改
                let old_checksum = old_skill.checksum.as_deref().unwrap_or("");
                let new_checksum = new_skill.checksum.as_deref().unwrap_or("");

                if old_checksum != new_checksum {
                    changes.push(SkillChange {
                        change_type: SkillChangeType::Modified,
                        skill_name: new_skill.name.clone(),
                        skill_path: path.clone(),
                        old_description: old_skill.description.clone(),
                        new_description: new_skill.description.clone(),
                        old_checksum: old_skill.checksum.clone(),
                        new_checksum: new_skill.checksum.clone(),
                    });
                }
            } else {
                // 不存在于旧版本，是新增
                changes.push(SkillChange {
                    change_type: SkillChangeType::Added,
                    skill_name: new_skill.name.clone(),
                    skill_path: path.clone(),
                    old_description: None,
                    new_description: new_skill.description.clone(),
                    old_checksum: None,
                    new_checksum: new_skill.checksum.clone(),
                });
            }
        }

        // 检测删除
        for (path, old_skill) in &old_map {
            if !new_map.contains_key(path) {
                changes.push(SkillChange {
                    change_type: SkillChangeType::Removed,
                    skill_name: old_skill.name.clone(),
                    skill_path: path.clone(),
                    old_description: old_skill.description.clone(),
                    new_description: None,
                    old_checksum: old_skill.checksum.clone(),
                    new_checksum: None,
                });
            }
        }

        changes
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub date: String,
}
```

## 四、数据库服务扩展

```rust
// src-tauri/src/services/database.rs

impl Database {
    /// 保存仓库更新记录
    pub fn save_repository_update(&self, update: &RepositoryUpdate) -> Result<()> {
        let conn = self.pool.get()?;

        conn.execute(
            "INSERT INTO repository_updates
            (id, repository_id, old_commit_sha, new_commit_sha, checked_at,
             skills_added, skills_modified, skills_removed, viewed)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                &update.id,
                &update.repository_id,
                &update.old_commit_sha,
                &update.new_commit_sha,
                &update.checked_at,
                serde_json::to_string(&update.changes.iter()
                    .filter(|c| matches!(c.change_type, SkillChangeType::Added))
                    .collect::<Vec<_>>())?,
                serde_json::to_string(&update.changes.iter()
                    .filter(|c| matches!(c.change_type, SkillChangeType::Modified))
                    .collect::<Vec<_>>())?,
                serde_json::to_string(&update.changes.iter()
                    .filter(|c| matches!(c.change_type, SkillChangeType::Removed))
                    .collect::<Vec<_>>())?,
                if update.viewed { 1 } else { 0 },
            ],
        )?;

        Ok(())
    }

    /// 获取未查看的更新记录
    pub fn get_unviewed_updates(&self) -> Result<Vec<RepositoryUpdate>> {
        let conn = self.pool.get()?;

        let mut stmt = conn.prepare(
            "SELECT u.*, r.name as repository_name
             FROM repository_updates u
             JOIN repositories r ON u.repository_id = r.id
             WHERE u.viewed = 0
             ORDER BY u.checked_at DESC"
        )?;

        let updates = stmt.query_map([], |row| {
            // 解析JSON数组...
            Ok(RepositoryUpdate {
                // 填充字段...
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(updates)
    }

    /// 标记更新为已查看
    pub fn mark_update_viewed(&self, update_id: &str) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "UPDATE repository_updates SET viewed = 1 WHERE id = ?1",
            params![update_id],
        )?;
        Ok(())
    }

    /// 更新仓库的commit SHA和更新状态
    pub fn update_repository_commit(
        &self,
        repo_id: &str,
        commit_sha: &str,
        has_updates: bool,
    ) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "UPDATE repositories
             SET latest_commit_sha = ?1, has_updates = ?2, last_checked = ?3
             WHERE id = ?4",
            params![
                commit_sha,
                if has_updates { 1 } else { 0 },
                Utc::now().to_rfc3339(),
                repo_id,
            ],
        )?;
        Ok(())
    }
}
```

## 五、Tauri命令

```rust
// src-tauri/src/commands/mod.rs

/// 检查仓库更新
#[tauri::command]
pub async fn check_repository_updates(
    state: tauri::State<'_, AppState>,
    repo_id: String,
) -> Result<Option<RepositoryUpdate>, String> {
    let repo = state.db.get_repository(&repo_id)
        .map_err(|e| e.to_string())?
        .ok_or("仓库不存在")?;

    let (owner, repo_name) = Repository::from_github_url(&repo.url)
        .map_err(|e| e.to_string())?;

    // 1. 检查是否有新commit
    let commit_info = state.github
        .check_repository_updates(&owner, &repo_name, repo.cached_commit_sha.as_deref())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(commit) = commit_info {
        // 2. 有更新：下载新版本到临时目录
        let temp_dir = tempfile::tempdir().map_err(|e| e.to_string())?;
        let new_extract_dir = state.github
            .download_repository_archive(&owner, &repo_name, temp_dir.path())
            .await
            .map_err(|e| e.to_string())?;

        // 3. 扫描新版本的skills
        let new_skills = state.github
            .scan_cached_repository(&new_extract_dir, repo.scan_subdirs)
            .map_err(|e| e.to_string())?;

        // 4. 获取旧版本的skills（从数据库）
        let old_skills = state.db
            .get_skills_by_repository(&repo_id)
            .map_err(|e| e.to_string())?;

        // 5. 对比生成变更列表
        let changes = state.github.compare_skills(&old_skills, &new_skills);

        // 6. 创建更新记录
        let update = RepositoryUpdate {
            id: uuid::Uuid::new_v4().to_string(),
            repository_id: repo_id.clone(),
            repository_name: repo.name.clone(),
            old_commit_sha: repo.cached_commit_sha.clone(),
            new_commit_sha: commit.sha.clone(),
            commit_message: Some(commit.message),
            commit_author: Some(commit.author),
            commit_date: Some(commit.date),
            checked_at: Utc::now().to_rfc3339(),
            changes,
            viewed: false,
        };

        // 7. 只有在有实际变更时才保存记录
        if update.has_changes() {
            state.db.save_repository_update(&update)
                .map_err(|e| e.to_string())?;

            state.db.update_repository_commit(&repo_id, &commit.sha, true)
                .map_err(|e| e.to_string())?;

            Ok(Some(update))
        } else {
            // 没有skill变更，只更新commit SHA
            state.db.update_repository_commit(&repo_id, &commit.sha, false)
                .map_err(|e| e.to_string())?;

            Ok(None)
        }
    } else {
        // 没有更新
        Ok(None)
    }
}

/// 应用仓库更新（下载新版本）
#[tauri::command]
pub async fn apply_repository_update(
    state: tauri::State<'_, AppState>,
    repo_id: String,
    update_id: String,
) -> Result<Vec<Skill>, String> {
    // 1. 清理旧缓存
    clear_repository_cache(state.clone(), repo_id.clone()).await?;

    // 2. 重新扫描（会下载新版本）
    let skills = scan_repository(state.clone(), repo_id.clone()).await?;

    // 3. 标记更新为已查看
    state.db.mark_update_viewed(&update_id)
        .map_err(|e| e.to_string())?;

    // 4. 清除has_updates标志
    state.db.update_repository_commit(&repo_id, "", false)
        .map_err(|e| e.to_string())?;

    Ok(skills)
}

/// 获取所有未查看的更新
#[tauri::command]
pub async fn get_unviewed_updates(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RepositoryUpdate>, String> {
    state.db.get_unviewed_updates()
        .map_err(|e| e.to_string())
}

/// 批量检查所有仓库的更新
#[tauri::command]
pub async fn check_all_repositories_updates(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<RepositoryUpdate>, String> {
    let repos = state.db.get_repositories()
        .map_err(|e| e.to_string())?;

    let mut all_updates = Vec::new();

    for repo in repos {
        if let Some(update) = check_repository_updates(state.clone(), repo.id).await? {
            all_updates.push(update);
        }
    }

    Ok(all_updates)
}
```

## 六、前端UI实现

### 6.1 更新提示组件

```typescript
// src/components/UpdateNotification.tsx

interface UpdateNotificationProps {
  updates: RepositoryUpdate[];
  onViewDetails: (update: RepositoryUpdate) => void;
  onApplyUpdate: (repoId: string, updateId: string) => void;
}

export function UpdateNotification({ updates, onViewDetails, onApplyUpdate }: UpdateNotificationProps) {
  if (updates.length === 0) return null;

  return (
    <div className="update-notification">
      <h3>🔔 发现 {updates.length} 个仓库有更新</h3>

      {updates.map((update) => {
        const [added, modified, removed] = update.countChanges();

        return (
          <div key={update.id} className="update-item">
            <div className="update-header">
              <strong>{update.repositoryName}</strong>
              <span className="commit-info">
                {update.commitAuthor} · {formatDate(update.commitDate)}
              </span>
            </div>

            <div className="update-message">
              {update.commitMessage}
            </div>

            <div className="update-stats">
              {added > 0 && <span className="added">+{added} 新增</span>}
              {modified > 0 && <span className="modified">~{modified} 修改</span>}
              {removed > 0 && <span className="removed">-{removed} 删除</span>}
            </div>

            <div className="update-actions">
              <button onClick={() => onViewDetails(update)}>
                查看详情
              </button>
              <button
                className="primary"
                onClick={() => onApplyUpdate(update.repositoryId, update.id)}
              >
                更新仓库
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 6.2 变更详情对话框

```typescript
// src/components/UpdateDetailsDialog.tsx

interface UpdateDetailsDialogProps {
  update: RepositoryUpdate;
  onClose: () => void;
  onApply: () => void;
}

export function UpdateDetailsDialog({ update, onClose, onApply }: UpdateDetailsDialogProps) {
  const addedSkills = update.changes.filter(c => c.changeType === 'added');
  const modifiedSkills = update.changes.filter(c => c.changeType === 'modified');
  const removedSkills = update.changes.filter(c => c.changeType === 'removed');

  return (
    <Dialog open onClose={onClose}>
      <div className="update-details">
        <h2>{update.repositoryName} 更新详情</h2>

        <div className="commit-info">
          <p><strong>提交信息：</strong>{update.commitMessage}</p>
          <p><strong>作者：</strong>{update.commitAuthor}</p>
          <p><strong>时间：</strong>{formatDate(update.commitDate)}</p>
          <p><strong>Commit：</strong><code>{update.newCommitSha.slice(0, 7)}</code></p>
        </div>

        {addedSkills.length > 0 && (
          <section className="changes-section added">
            <h3>✨ 新增 Skills ({addedSkills.length})</h3>
            {addedSkills.map((change) => (
              <div key={change.skillPath} className="change-item">
                <div className="skill-name">{change.skillName}</div>
                <div className="skill-desc">{change.newDescription}</div>
                <div className="skill-path">{change.skillPath}</div>
              </div>
            ))}
          </section>
        )}

        {modifiedSkills.length > 0 && (
          <section className="changes-section modified">
            <h3>📝 修改 Skills ({modifiedSkills.length})</h3>
            {modifiedSkills.map((change) => (
              <div key={change.skillPath} className="change-item">
                <div className="skill-name">{change.skillName}</div>

                {change.oldDescription !== change.newDescription && (
                  <div className="diff">
                    <div className="old">- {change.oldDescription}</div>
                    <div className="new">+ {change.newDescription}</div>
                  </div>
                )}

                <div className="skill-path">{change.skillPath}</div>
              </div>
            ))}
          </section>
        )}

        {removedSkills.length > 0 && (
          <section className="changes-section removed">
            <h3>🗑️ 删除 Skills ({removedSkills.length})</h3>
            {removedSkills.map((change) => (
              <div key={change.skillPath} className="change-item">
                <div className="skill-name">{change.skillName}</div>
                <div className="skill-desc">{change.oldDescription}</div>
                <div className="skill-path">{change.skillPath}</div>
              </div>
            ))}
          </section>
        )}

        <div className="actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={onApply}>
            更新仓库
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

### 6.3 仓库列表集成

```typescript
// src/components/RepositoriesPage.tsx

export function RepositoriesPage() {
  const { data: repos } = useRepositories();
  const { data: updates } = useQuery({
    queryKey: ['unviewed-updates'],
    queryFn: api.getUnviewedUpdates,
    refetchInterval: 5 * 60 * 1000, // 每5分钟检查一次
  });

  const checkUpdatesMutation = useMutation({
    mutationFn: api.checkAllRepositoriesUpdates,
  });

  return (
    <div>
      <UpdateNotification
        updates={updates || []}
        onViewDetails={(update) => setSelectedUpdate(update)}
        onApplyUpdate={handleApplyUpdate}
      />

      <div className="toolbar">
        <button onClick={() => checkUpdatesMutation.mutate()}>
          检查所有仓库更新
        </button>
      </div>

      {repos.map((repo) => (
        <div key={repo.id} className="repo-item">
          {repo.hasUpdates && <Badge>有更新</Badge>}
          {/* 其他内容 */}
        </div>
      ))}
    </div>
  );
}
```

## 七、自动检查更新策略

### 选项1：定时检查（推荐）
- 应用启动时检查一次
- 每隔N小时自动检查（可配置）
- 后台检查，不阻塞UI

### 选项2：手动检查
- 用户点击"检查更新"按钮
- 更精确控制API配额使用

### 选项3：智能检查
- 结合定时和手动
- 智能判断检查频率（如仓库活跃度）
- 接近API限额时降低检查频率

## 八、API配额优化

### 每次完整检查消耗
- 检查N个仓库：N次API请求（获取latest commit）
- 有更新的仓库：额外1次下载请求

### 示例
- 10个仓库，2个有更新：10 + 2 = **12次请求**
- 不检查更新：**0次请求**（使用缓存）

### 优化建议
- 默认每天检查1-2次
- 用户可在设置中配置检查频率
- 显示上次检查时间和下次检查时间

## 九、实施步骤

### 阶段1：核心功能（必需）
1. ✅ 数据库schema扩展
2. ✅ GitHubService添加commit检查和skills对比
3. ✅ Tauri命令：check_repository_updates, apply_repository_update
4. ✅ 前端基础UI：更新通知、详情对话框

### 阶段2：增强功能（推荐）
1. ✅ 批量检查所有仓库
2. ✅ 自动定时检查
3. ✅ 更新历史记录查询
4. ✅ 差异对比可视化

### 阶段3：高级功能（可选）
1. ⭐ 忽略特定更新
2. ⭐ 更新回滚功能
3. ⭐ 变更通知推送
4. ⭐ 更新日志导出

## 十、用户体验流程

```
1. 用户打开应用
   ↓
2. 后台自动检查更新（或手动点击"检查更新"）
   ↓
3. 发现2个仓库有更新，显示通知气泡
   ↓
4. 用户点击"查看详情"
   ↓
5. 显示变更列表：
   - anthropics/claude-skills: +2新增, ~1修改
     • ✨ 新增：data-analysis skill
     • ✨ 新增：code-review skill
     • 📝 修改：debugging skill (描述更新)
   ↓
6. 用户点击"更新仓库"
   ↓
7. 下载新版本，替换缓存，更新数据库
   ↓
8. 提示"更新成功！已发现2个新skills"
```
