<div align="center">

# 🛡️ Agent Skills Guard

### Making Claude Code Skills Management as Simple and Secure as an App Store

[![Version](https://img.shields.io/badge/version-0.9.6-blue.svg)](https://github.com/brucevanfdm/agent-skills-guard/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg)](https://github.com/brucevanfdm/agent-skills-guard/releases)

English | [简体中文](README.md)

</div>

---

## ⚡ Why Agent Skills Guard?

When enjoying Claude Code's AI-assisted programming, do you face these frustrations:

- 🔐 **Security concerns**: Want to install new skills but worried about code risks, don't know how to judge?
- 📦 **Management chaos**: Skills scattered everywhere, don't know which to keep or delete?
- 🔍 **Discovery difficulties**: Don't know where to find quality community skills, missing many great tools?

**Agent Skills Guard** is designed to solve these problems. It transforms the skills world originally hidden in command lines and folders into a **visible, manageable, trustworthy** app store experience.

<div align="center">

**🎯 Core value in three seconds: Visual management + Security scanning + Featured repositories**

[⭐ Download Now](https://github.com/brucevanfdm/agent-skills-guard/releases) | [📖 Quick Start Guide](#-quick-start)

</div>

---

## 🌟 Four Core Features

### 🔄 Full Lifecycle Management

Manage Claude Code skills like managing mobile apps, from discovery, installation, updates to uninstallation, all with visual operations.

- ✅ **One-click install**: Install directly from featured or custom repositories
- 🔄 **Smart updates**: Automatically detect skill updates, support online upgrades
- 🗑️ **Easy uninstall**: Support multi-path installation management, clean on demand
- 📂 **Custom paths**: Flexibly choose skill installation locations

### 🛡️ Industry-Leading Security Scanning

**Covering 8 major risk categories with 10 hard-trigger protections**, making skill use more secure.

- 🔍 **8 risk categories**: Destructive operations, remote code execution, command injection, data exfiltration, privilege escalation, persistence, sensitive information leakage, sensitive file access
- 🚫 **10 hard-trigger rules**: Directly block high-risk operations, no冒险
- 🔗 **Symbolic link detection**: Prevent symlink attacks
- 📊 **Security scoring system**: 0-100 score intuitive display
- 📝 **Detailed scan reports**: Tell you where the risk is, why it's risky, how to fix it
- 🎯 **Confidence grading**: High/Medium/Low three-level confidence, reduce false positives

### 🌟 Featured Skills Repository

Built-in manually curated quality skills repository, automatically syncs updates, discovering quality skills has never been easier.

- 📚 **Featured skills library**: Manually selected quality skills
- 🔄 **Auto refresh**: Silent update on startup, keep latest
- ➕ **Custom repositories**: Support adding any GitHub repository

### 🎨 Modern Visual Management

Say goodbye to command lines and enjoy the intuitive cyberpunk-style interface.

- 🎨 **Cyberpunk theme**: Unique terminal style design
- ⚡ **Smooth animations**: Carefully polished interaction experience
- 🌐 **Bilingual interface**: Complete Chinese and English interface support
- 📱 **Responsive layout**: Perfect adaptation to various screen sizes

---

## 🆚 Traditional Way vs Agent Skills Guard

| Feature            | Traditional Way                   | Agent Skills Guard               |
| ------------------ | --------------------------------- | -------------------------------- |
| **Discover skills** | ❌ Aimlessly search GitHub      | ✅ Featured repo, one-click browse |
| **Security check** | ❌ Manual code review, time-consuming | ✅ 8-category auto scan, instant results |
| **Install skills** | ❌ Command line, error-prone    | ✅ Visual UI, click to install  |
| **Manage skills**  | ❌ Folder digging, unclear usage | ✅ Intuitive list, clear status |
| **Update skills**  | ❌ Manual check, repetitive     | ✅ Auto detect, batch update    |
| **Uninstall skills** | ❌ Manual delete, worried leftovers | ✅ One-click uninstall, auto cleanup |

---

## 🚀 Quick Start

### 📥 Installation

Visit [GitHub Releases](https://github.com/brucevanfdm/agent-skills-guard/releases) to download the latest version:

- **macOS**: Download `.dmg` file, drag to install
- **Windows**: Download `.msi` installer, double-click to install

<div align="center">

*Security warnings on first launch can be safely ignored*

</div>

### 🎯 First Time Use

**Step 1: Configure Repositories**

Open the app and you'll see built-in featured skills repositories. You can also:

- Click "Repository Configuration" to add your favorite GitHub repositories
- Wait for automatic scan to complete (manual refresh supported)

**Step 2: Browse and Install**

- Browse and search skills in "Skills Marketplace"
- Click "Install", system will automatically perform security scan
- Check security score and scan report, install with peace of mind

**Step 3: Manage Installed Skills**

- One-click scan all skills' security status in "Overview" page
- View details, update or uninstall in "My Skills"

## 💎 Interface Showcase

### 📊 Overview Page - One-Click Security Scan

See all skills' security status at a glance, risk classification statistics, problem details一览无余.

![Overview](screen-shot/overview.png)

### 🛡️ Security Scan Report

Detailed scan results, including security score, risk level, problem list.

![Scan result](screen-shot/scanresult.png)

### 📦 My Skills

View all installed skills, support multi-path management, batch update and uninstall.

![My skills](screen-shot/myskills.png)

### 🛒 Skills Marketplace

Explore and install community skills from featured repositories.

![Skills marketplace](screen-shot/skillsmarket.png)

### 🗄️ Repository Configuration

Add and manage skill sources, built-in featured repositories auto-update.

![Repositories](screen-shot/repositories.png)
![Featured repositories](screen-shot/featuredrepositories.png)
![Skills update](screen-shot/skillsupdate.png)

---

## 🛡️ Security Scanning Details

### Scanning Mechanism

Our security scanning engine analyzes every file of skill code to detect potential risks:

- **File scanning strategy**: Skip large directories like `node_modules`, `target`, limit scan depth and file count
- **Symbolic link detection**: Immediately hard-block on symlink discovery, prevent attacks
- **Multi-format support**: Support `.js`, `.ts`, `.py`, `.sh`, `.rs` and other code formats

### Risk Classification

| Category                  | Detection Content           | Examples                          |
| ------------------------- | --------------------------- | --------------------------------- |
| **Destructive Operations** | Delete system files, disk wipe | `rm -rf /`, `mkfs`           |
| **Remote Code Execution**  | Pipe execution, deserialization | `curl \| bash`, `pickle.loads` |
| **Command Injection**      | Dynamic command concatenation | `eval()`, `os.system()`       |
| **Data Exfiltration**      | Data exfiltration to remote servers | `curl -d @file`             |
| **Privilege Escalation**   | Escalation operations       | `sudo`, `chmod 777`           |
| **Persistence**            | Backdoor implantation       | `crontab`, SSH key injection    |
| **Sensitive Info Leakage** | Hardcoded keys, Tokens      | AWS Key, GitHub Token           |
| **Sensitive File Access**  | Access system sensitive files | `~/.ssh/`, `/etc/passwd`    |

### Scoring System

- **90-100 (✅ Safe)**: Safe to use
- **70-89 (⚠️ Low Risk)**: Minor risk, recommend checking details
- **50-69 (⚠️ Medium Risk)**: Certain risk, use with caution
- **30-49 (🔴 High Risk)**: High risk, not recommended for installation
- **0-29 (🚨 Critical Risk)**: Serious threat, installation prohibited

### Disclaimer

Security scanning is based on preset rules, designed to help identify potential risks, but cannot guarantee 100% accuracy, and false positives or false negatives may exist. It is recommended to carefully read the skill source code before installation and be extra cautious with skills from untrusted sources. Users assume all consequences of using this program.

---

## 💡 Use Cases

### Case 1: Discover New Skills

You see a skill on GitHub that can automatically generate code comments, want to try but worried about security.

**With Agent Skills Guard:**

1. Search for this skill in "Skills Marketplace"
2. Click "Install", system automatically scans
3. See security score is 85, with 2 low-risk alerts
4. Check details and find it acceptable, click "Install Anyway"
5. ✅ Install successfully, use with peace of mind

### Case 2: Regular Security Check

Every month, you want to check the security status of installed skills.

**With Agent Skills Guard:**

1. Open "Overview" page
2. Click "One-Click Scan"
3. Check scan report, find a skill's security score dropped
4. Check details and find the skill added network request code
5. Decide to uninstall that skill or rollback to old version
6. ✅ Skills library stays secure and controlled

### Case 3: Skills Cleanup

Your skills directory is full of various skills, want to clean up.

**With Agent Skills Guard:**

1. Open "My Skills" page
2. Browse all skills and their descriptions
3. See several skills you've forgotten their purpose
4. Select these skills, click "Uninstall"
5. ✅ Skills library refreshed

---

## ❓ FAQ

### Q: Can security scanning produce false positives?

A: Yes. Scanning is based on rule matching and may mark harmless code as risky. It's recommended to check the code context in the scan report to determine if there's really a risk.

### Q: Can I add my own skills repository?

A: Yes! Add any GitHub repository on the "Repository Configuration" page, and the app will automatically scan and discover skills within it.

### Q: Does the app auto-update?

A: Yes, the app automatically detects updates and prompts you when a new version is available.

### Q: Where are skills installed?

A: By default installed to `~/.claude/skills/`, and you can also choose custom paths during installation, supporting installation to project folders.

---

## 📝 Changelog

[View full changelog](https://github.com/brucevanfdm/agent-skills-guard/releases)

---

## 🗺️ Roadmap

- [ ] Same-name skills management: Intelligently handle same-name skill compatibility
- [ ] Enhanced security scanning: More dimensions of security detection
- [ ] Skills rating system: Community ratings and usage statistics
- [ ] More new features

---

## 📦 Download & Feedback

### Download

- 📦 [GitHub Releases](https://github.com/brucevanfdm/agent-skills-guard/releases) - Get the latest version

### Contact

Have questions or suggestions? Contact via:

- 💬 [GitHub Issues](https://github.com/brucevanfdm/agent-skills-guard/issues) - Report issues or suggest features
- 🐦 [X/Twitter](https://x.com/brucevanfdm) - Follow project updates
- 💬 **Agent Skills Security Community**

<div align="center">

![Community](screen-shot/agentskillsgroup.jpg)

</div>

---

## 🔧 For Developers

If you're a developer and want to build from source or contribute:

```bash
# 1. Clone the project
git clone https://github.com/brucevanfdm/agent-skills-guard.git
cd agent-skills-guard

# 2. Install dependencies (requires pnpm)
pnpm install

# 3. Run in development mode
pnpm dev

# 4. Build production version
pnpm build
```

**Tech Stack**: React 18 + TypeScript + Tauri 2 + Tailwind CSS

---

## 📜 License

MIT License - Free to use, free to share

---

<div align="center">

Made with ❤️ by [Bruce](https://github.com/brucevanfdm)

If this project helps you, please give it a ⭐️ Star!

[⬆ Back to top](#-agent-skills-guard)

</div>
