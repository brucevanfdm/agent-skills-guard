# 🚀 快速开始指南

## 安装依赖

### 1. 安装 Node.js 和 pnpm

```bash
# macOS (使用 Homebrew)
brew install node
npm install -g pnpm

# Windows (使用 Chocolatey)
choco install nodejs
npm install -g pnpm
```

### 2. 安装 Rust 和 Tauri CLI

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Tauri CLI
cargo install tauri-cli
```

## 启动开发环境

### 克隆并进入项目

```bash
cd /Users/bruce/Downloads/agent-skills-guard
```

### 安装前端依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
# 方法 1: 一键启动（推荐）
pnpm dev

# 方法 2: 分别启动前后端
# 终端 1: 启动前端开发服务器
pnpm dev:renderer

# 终端 2: 启动 Tauri
pnpm tauri dev
```

第一次启动会编译 Rust 后端，需要等待几分钟。

## 基本使用流程

### 1. 添加仓库

1. 点击「仓库配置」标签
2. 点击「添加仓库」按钮
3. 填写信息：
   - **仓库名称**：`Anthropic Official`
   - **GitHub URL**：`https://github.com/anthropics/anthropic-quickstarts`
4. 点击「确认添加」

### 2. 扫描 Skills

1. 在仓库列表中找到刚添加的仓库
2. 点击「扫描」按钮
3. 等待扫描完成（约 5-10 秒）

### 3. 查看和安装 Skills

1. 切换到「Skills 管理」标签
2. 查看扫描到的 Skills 列表
3. 点击「详情」查看安全报告
4. 安全评分 ≥ 50 的可以点击「安装」

### 4. 管理已安装的 Skills

1. 点击「已安装」过滤器
2. 查看所有已安装的 Skills
3. 点击「卸载」可以移除 Skill

## 常见问题

### Q: 编译失败怎么办？

**A**: 检查依赖版本

```bash
# 检查 Rust 版本
rustc --version  # 应该 >= 1.85

# 检查 Node 版本
node --version   # 应该 >= 18

# 更新依赖
pnpm install
cd src-tauri && cargo update
```

### Q: 启动后窗口空白？

**A**: 检查前端开发服务器

```bash
# 确保前端服务器在运行
pnpm dev:renderer

# 访问 http://localhost:5173 检查是否正常
```

### Q: GitHub API 限流怎么办？

**A**: GitHub 未认证限制 60 次/小时，可以添加认证：

```rust
// src-tauri/src/services/github.rs
// 添加 GitHub Token (可选)
let client = Client::builder()
    .user_agent("agent-skills-guard/0.1.0")
    .default_headers({
        let mut headers = HeaderMap::new();
        headers.insert(
            "Authorization",
            HeaderValue::from_str("token YOUR_GITHUB_TOKEN").unwrap()
        );
        headers
    })
    .build()
    .unwrap();
```

### Q: 安全评分是如何计算的？

**A**: 评分规则：

```
基础分：100 分

扣分规则：
- Critical 问题：-30 分/个
- Error 问题：-20 分/个
- Warning 问题：-10 分/个
- Info 问题：-5 分/个

最终评分 = max(0, 基础分 - 总扣分)

安装限制：
- 评分 < 50：禁止安装
- 评分 >= 50：允许安装
```

## 构建生产版本

### macOS

```bash
pnpm build
# 输出: src-tauri/target/release/bundle/macos/Agent Skills Guard.app
```

### Windows

```bash
pnpm build
# 输出: src-tauri/target/release/bundle/msi/Agent Skills Guard_0.1.0_x64.msi
```

## 开发调试

### 查看日志

```bash
# Rust 日志
RUST_LOG=debug pnpm tauri dev

# 前端日志
打开浏览器开发者工具 (Cmd+Option+I / F12)
```

### 调试 SQLite 数据库

```bash
# 数据库位置
macOS: ~/Library/Application Support/com.agent-skills-guard.app/agent-skills.db
Windows: %APPDATA%\com.agent-skills-guard.app\agent-skills.db

# 使用 SQLite 客户端查看
sqlite3 ~/Library/Application\ Support/com.agent-skills-guard.app/agent-skills.db

# 查看表
.tables

# 查看 skills 数据
SELECT name, security_score, installed FROM skills;
```

### 重置数据库

```bash
# 删除数据库文件即可重置
rm ~/Library/Application\ Support/com.agent-skills-guard.app/agent-skills.db
```

## 代码格式化

### 前端

```bash
# 格式化
pnpm format

# 检查格式
pnpm format:check

# 类型检查
pnpm typecheck
```

### 后端

```bash
cd src-tauri

# 格式化
cargo fmt

# Lint 检查
cargo clippy

# 运行测试
cargo test
```

## 项目结构快速参考

```
agent-skills-guard/
├── src/                    # 前端代码
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # API 封装
│   └── types/              # TypeScript 类型
│
├── src-tauri/              # 后端代码
│   └── src/
│       ├── commands/       # Tauri Commands
│       ├── models/         # 数据模型
│       ├── security/       # 安全扫描
│       └── services/       # 业务逻辑
│
├── package.json            # 前端依赖
└── src-tauri/Cargo.toml    # Rust 依赖
```

## 下一步

- 阅读 [README.md](README.md) 了解项目详情
- 阅读 [ARCHITECTURE.md](ARCHITECTURE.md) 了解架构设计
- 开始添加仓库和扫描 Skills！

---

**祝您使用愉快！**

如有问题，欢迎提交 Issue。
