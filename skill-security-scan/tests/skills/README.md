# Skills 测试用例

此目录包含用于测试 skill-security-scan 工具的 Skill 示例。

## 目录结构

```
tests/skills/
├── valid_skills/           # 符合规范的安全 Skills
│   └── log-analyzer/      # 日志分析工具
│       ├── SKILL.md
│       ├── README.md
│       └── utils/
│           └── log_parser.py
│
└── malicious_skills/       # 包含安全隐患的 Skills
    ├── README.md          # 详细说明
    └── data-optimizer/    # 数据优化工具（恶意）
        ├── SKILL.md
        ├── README.md
        └── scripts/
            ├── setup.sh
            └── optimizer.py
```

## 测试目的

### 1. valid_skills - 安全示例

**log-analyzer**
- ✅ 符合 Claude Skills 规范
- ✅ 只读操作，不修改文件
- ✅ 不执行系统命令
- ✅ 不访问网络
- ✅ 不读取敏感文件
- ✅ 纯 Python 实现

**预期扫描结果**:
- 风险等级: SAFE 或 LOW
- 风险分数: 0-2
- 严重问题: 0

### 2. malicious_skills - 恶意示例

**data-optimizer**
- ❌ 包含 15+ 种安全问题
- ❌ 向外部服务器发送数据
- ❌ 读取敏感文件（SSH 密钥、环境变量）
- ❌ 执行危险系统命令
- ❌ 代码注入和后门植入
- ❌ 全局安装覆盖依赖

**预期扫描结果**:
- 风险等级: CRITICAL
- 风险分数: 9-10
- 严重问题: 10+

## 运行测试

### 手动测试

```bash
# 扫描安全 Skill
python -m src.cli scan tests/skills/valid_skills/log-analyzer

# 扫描恶意 Skill
python -m src.cli scan tests/skills/malicious_skills/data-optimizer

# 生成 JSON 报告
python -m src.cli scan tests/skills/malicious_skills/data-optimizer \
  --output malicious_report.json --format json
```

### 自动化测试

```bash
# 运行所有测试
pytest tests/test_skills_scanner.py -v

# 运行特定测试
pytest tests/test_skills_scanner.py::TestSkillsScanner::test_scan_malicious_skill -v

# 生成覆盖率报告
pytest tests/test_skills_scanner.py --cov=src --cov-report=html
```

## 检测规则覆盖

### 恶意示例检测的问题类型

| 规则 ID | 类别 | 检测内容 | 数量 |
|---------|------|---------|------|
| NET001 | 网络安全 | 外部网络请求 | 5+ |
| NET002 | 网络安全 | 数据外传 | 3+ |
| FILE001 | 文件操作 | 敏感文件访问 | 4+ |
| FILE002 | 文件操作 | 危险文件操作 | 3+ |
| CMD001 | 命令执行 | 危险系统命令 | 4+ |
| CMD002 | 命令执行 | 系统命令调用 | 6+ |
| INJ001 | 代码注入 | 代码注入 | 2+ |
| INJ002 | 代码注入 | 动态代码执行 | 4+ |
| INJ003 | 代码注入 | 后门植入 | 2+ |
| DEP001 | 依赖安全 | 全局包安装 | 3+ |
| DEP002 | 依赖安全 | 强制版本覆盖 | 2+ |
| OBF001 | 代码混淆 | 代码混淆 | 2+ |
| OBF002 | 代码混淆 | 隐藏命令 | 3+ |

**总计**: 15+ 条规则触发，40+ 个问题检测

## 教育价值

这些示例用于：

1. **测试扫描工具** - 验证工具能正确检测各种安全问题
2. **教育开发人员** - 了解常见的攻击模式
3. **提高安全意识** - 识别恶意代码的迹象
4. **最佳实践** - 对比安全 vs 不安全的实现

## 贡献新示例

欢迎贡献更多的测试示例：

1. **安全示例** - 展示最佳实践
2. **恶意示例** - 展示新的攻击模式
3. **边界情况** - 测试工具的极限

请在 PR 中说明：
- 示例的用途
- 预期的扫描结果
- 应该触发哪些规则

## 免责声明

⚠️ 恶意示例仅用于安全测试和教育目的！
- 请勿在真实系统中使用
- 请勿用于恶意目的
- 遵守当地法律法规
