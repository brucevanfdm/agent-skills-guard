# Claude Code Plugin 自动安装（Marketplace 模式）需求

## 0. 背景与目标

我们正在开发一款 Skills/Plugin 管理器（Tauri + Rust）。当前已实现：

- ✅ Skills-only 安装（拷贝到 `~/.claude/skills/` 或项目 `.claude/skills/`）
- ✅ 从 GitHub 拉取仓库更新后的 skills 并更新本地安装
- ✅ 特色能力：任何安装落地前都要做**安全扫描**，通过才允许继续
- ✅ 已有数据库与业务结构

本次新增能力：

- ✅ 支持 **Claude Code Plugin（Marketplace 模式）自动安装**
- ✅ 全流程复用现有安全扫描逻辑（安装前必须扫描）与仓库添加逻辑

非目标：

- ❌ 不做 Codex/OpenCode 的手动安装兼容（仅检测并提示）
- ❌ 不解析 README 的安装文本来执行（统一走标准化流程）
- ❌ 不直接读写 Claude Code 插件缓存目录（避免内部结构变化导致不稳定）

---

## 1. Claude Code Plugin 的手动流程（需要自动化）

示例插件安装方式：

1. 添加 marketplace：

```
/plugin marketplace add obra/superpowers-marketplace
```

1. 安装 plugin：

```
/plugin install superpowers@superpowers-marketplace
```

1. 验证命令出现：

```
/help
# Should see:
# /superpowers:brainstorm
# /superpowers:write-plan
# /superpowers:execute-plan
```

管理器需要把上述变成“一键安装”。

---

## 2. 总体方案（核心原则）

### 2.1 不直接操纵 Claude 插件目录

插件安装统一通过 **驱动 Claude Code 的交互命令（PTY）**完成，管理器只负责：

- staging 拉取源码
- 安全扫描
- 调用 Claude Code 命令完成安装
- 解析输出、落库、展示日志与状态

### 2.2 任何落地安装动作前必须安全扫描

技能安装是“拷贝到目录”；插件安装是“Claude Code 拉取写入内部缓存”。为了复用“安装前扫描”，插件安装必须改为：

- 先把待安装内容拉取到 staging 临时目录
- 扫描 staging 内容
- 扫描通过后才允许执行 `/plugin install ...`

---

## 3. 支持范围

### 3.1 只支持 Marketplace 模式自动安装

输入形式：

- `marketplace_repo`：`owner/repo` 例如 `obra/superpowers-marketplace`
- `plugin_spec`：`plugin@marketplace-name` 例如 `superpowers@superpowers-dev`

marketplace-name 的权威来源：

- 以 `.claude-plugin/marketplace.json` 里的 `name` 字段为准

### 3.2 其它类型处理策略

- 若 repo 不符合 marketplace/plugin 标准结构 → 提示“不支持自动安装，需要手动安装”
- Skills-only 已实现，不在本需求范围内

---

## 4. 新增功能需求

## 4.1 插件自动安装（Marketplace 安装）

复用兼容现有的逻辑，识别仓库是plugin or skills only。

支持的 plugins[].source 范围：

- `"./"`：插件源为仓库根目录
- `"<subdir>"`：插件源为仓库子目录（例如 `plugins/foo`）

当 marketplace.json 存在多个 plugins 条目时：

- 直接安装全部 plugin

插件元数据来源：

- 固定读取 `<source>/.claude-plugin/plugin.json`

---

## 4.2 安装前安全扫描（必须复用现有逻辑）

要求：**插件安装前必须扫描**。

---

## 4.3 安装后验证

暂不实现

---

## 5. Rust/Tauri 实现要求

## 5.1 Claude Code CLI 驱动（PTY 必须）

- 使用 PTY 运行 Claude Code CLI（不能仅靠 stdin pipe）
- 能做到：
  - 发送命令（带换行）
  - 读取输出直到稳定/提示符/超时
  - 返回 raw_log

每条命令 timeout 建议：

- marketplace add：30~60s
- install plugin：60~180s（允许更长）
- help verify：10~30s

可选 crate：

- `portable-pty` 或 `expectrl`

---

## 5.2 输出解析（最低可用）

需要识别：

- marketplace add 成功 / 已存在（幂等）
- plugin install 成功 / 已安装（幂等）

实现允许非常简单：

- contains 判断 + regex（可扩展）
