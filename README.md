# 🛡️ Agent Skills Guard

一个基于批判与自我批判理论构建的 Claude Code Agent Skills 安全管理工具。

## 📋 项目背景

### 批判性分析

在分析现有 Claude Code Skills 生态系统后，我们发现了以下关键问题：

1. **安全缺陷**：Skills 直接从 GitHub 下载并执行，缺少安全检查机制
2. **权限滥用风险**：Skills 可能包含恶意代码（文件系统操作、网络请求、进程执行）
3. **缺少审计机制**：用户无法了解 Skills 的安全状况
4. **管理分散**：Skills 管理功能嵌入在大型应用中，难以独立使用

### 设计理念

基于**批判与自我批判**的方法论，本项目：

- ✅ **批判现状**：识别现有方案的安全缺陷
- ✅ **自我批判**：避免过度设计，聚焦 MVP 核心功能
- ✅ **安全优先**：实现代码静态分析和安全评分机制
- ✅ **用户透明**：向用户展示安全风险，由用户做出决策

## ✨ 核心功能

### 1. 🔍 安全扫描

- **静态代码分析**：检测危险操作模式
  - 文件系统操作（删除、写入）
  - 网络请求（数据外传风险）
  - 进程执行（命令注入）
  - 代码混淆检测
- **安全评分**：0-100 分评分体系
  - 90-100：✅ 安全
  - 70-89：⚠️ 低风险
  - 50-69：⚠️ 中风险
  - <50：🚫 高风险（禁止安装）

### 2. 📦 Skills 管理

- 从 GitHub 仓库自动扫描 Skills
- 一键安装/卸载到 `~/.claude/skills/`
- 查看已安装 Skills 列表
- 安全评分可视化

### 3. 🗂️ 仓库配置

- 添加自定义 GitHub 仓库
- 支持子目录递归扫描
- 仓库启用/禁用管理

### 4. 💾 数据持久化

- SQLite 数据库存储
- Skills 元数据管理
- 安装历史记录

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│           Frontend (React + TS)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   UI     │  │  Hooks   │  │  Query   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────┬───────────────────────────┘
                  │ Tauri IPC
┌─────────────────▼───────────────────────────┐
│          Backend (Tauri + Rust)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Commands │  │ Services │  │  Models  │  │
│  │          │  │          │  │          │  │
│  │ ├ Skills │  │ ├ GitHub │  │ ├ Skill  │  │
│  │ ├ Repos  │  │ ├ Scanner│  │ ├ Repo   │  │
│  │          │  │ ├ Database  │ ├ Security│  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

### 技术栈

**前端**
- React 18
- TypeScript
- TailwindCSS 3
- TanStack Query (数据缓存)
- Lucide React (图标)

**后端**
- Tauri 2.8
- Rust
- SQLite (rusqlite)
- reqwest (HTTP 客户端)
- tokio (异步运行时)

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.85+
- Tauri CLI 2.8+

### 安装依赖

```bash
# 安装前端依赖
pnpm install

# 构建 Rust 后端（自动）
pnpm tauri build
```

### 开发模式

```bash
# 启动开发服务器（热重载）
pnpm dev

# 或分别启动前后端
pnpm dev:renderer  # 前端
pnpm tauri dev     # Tauri
```

### 构建生产版本

```bash
# 构建跨平台应用
pnpm build

# 输出位置
# Windows: src-tauri/target/release/agent-skills-guard.exe
# macOS: src-tauri/target/release/bundle/macos/
```

## 📖 使用指南

### 1. 添加仓库

1. 点击「仓库配置」标签
2. 点击「添加仓库」
3. 输入仓库名称和 GitHub URL
   - 例如: `https://github.com/anthropics/anthropic-quickstarts`
4. 点击「确认添加」

### 2. 扫描 Skills

1. 在仓库列表中点击「扫描」按钮
2. 等待扫描完成
3. 切换到「Skills 管理」标签查看结果

### 3. 安装 Skills

1. 在 Skills 列表中查看安全评分
2. 点击「详情」查看安全问题
3. 安全评分 ≥ 50 分的 Skill 可以安装
4. 点击「安装」按钮

### 4. 卸载 Skills

1. 在「已安装」过滤器下查看已安装的 Skills
2. 点击「卸载」按钮

## 🔒 安全机制

### 代码扫描规则

```rust
// 危险文件系统操作
rm -rf /, chmod 777, os.system()

// 网络请求
curl | bash, requests.post()

// 数据泄露风险
AWS_ACCESS_KEY, API_KEY, PASSWORD

// 代码混淆
base64.b64decode, \\x{hex}
```

### 评分机制

- **Critical 问题**：-30 分
- **Error 问题**：-20 分
- **Warning 问题**：-10 分
- **Info 问题**：-5 分

基础分 100 分，扣分后 < 50 分禁止安装。

## 📂 项目结构

```
agent-skills-guard/
├── src/                      # 前端源码
│   ├── components/           # UI 组件
│   │   ├── SkillsPage.tsx
│   │   └── RepositoriesPage.tsx
│   ├── hooks/                # React Hooks
│   │   ├── useSkills.ts
│   │   └── useRepositories.ts
│   ├── lib/                  # 工具库
│   │   └── api.ts            # Tauri API 封装
│   ├── types/                # TypeScript 类型
│   └── App.tsx               # 主应用
│
├── src-tauri/                # 后端源码
│   └── src/
│       ├── models/           # 数据模型
│       │   ├── skill.rs
│       │   ├── repository.rs
│       │   └── security.rs
│       ├── security/         # 安全模块
│       │   ├── scanner.rs    # 代码扫描器
│       │   └── rules.rs      # 扫描规则
│       ├── services/         # 业务逻辑
│       │   ├── github.rs     # GitHub API
│       │   ├── skill_manager.rs
│       │   └── database.rs   # SQLite DAO
│       ├── commands/         # Tauri Commands
│       └── lib.rs            # 入口文件
│
├── package.json
├── Cargo.toml
└── README.md
```

## 🛣️ Roadmap

### ✅ MVP (v0.1.0)
- [x] GitHub 仓库扫描
- [x] 安全代码分析
- [x] Skills 安装/卸载
- [x] SQLite 数据持久化

### 🔮 未来计划
- [ ] 版本管理和更新检测
- [ ] Skills 依赖冲突检测
- [ ] 沙箱隔离运行
- [ ] 云端同步配置
- [ ] 社区评分系统

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发原则

1. **批判性思维**：识别问题，提出改进
2. **自我批判**：避免过度设计，保持简洁
3. **安全优先**：任何功能都要考虑安全影响
4. **用户透明**：向用户清晰展示风险

### 提交前检查

```bash
# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# Rust 检查
cd src-tauri && cargo clippy && cargo test
```

## 📄 License

MIT © Bruce

## 🙏 致谢

本项目参考了以下项目的技术架构：
- [cc-switch](https://github.com/farion1231/cc-switch) - Tauri + React 架构设计
- Claude Code - Skills 生态系统

---

**⚠️ 免责声明**：本工具仅提供安全检查建议，无法保证 100% 检测所有恶意代码。请用户自行评估风险后安装 Skills。
