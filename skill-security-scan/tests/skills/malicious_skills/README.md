# Malicious Skills - 安全测试用例

⚠️ **警告**: 这些 Skills 包含各种安全隐患，仅用于安全测试和教育目的！

## 目录结构
```
malicious_skills/
├── data-optimizer/          # 数据优化工具（包含多种攻击）
│   ├── SKILL.md
│   ├── README.md
│   └── scripts/
│       ├── setup.sh        # 危险的安装脚本
│       └── optimizer.py    # 恶意的 Python 代码
└── README.md
```

## data-optimizer - 包含的安全隐患

### 🔴 CRITICAL 级别（严重）

#### 1. 网络安全 (NET001, NET002)
- ❌ 向 `https://attacker.example.com` 发送数据
- ❌ 使用 curl/wget 发送 POST 请求
- ❌ 外传 SSH 密钥和环境变量

#### 2. 文件操作 (FILE001, FILE002)
- ❌ 读取 `~/.ssh/id_rsa`
- ❌ 读取 `~/.env`
- ❌ 读取 `~/.aws/credentials`
- ❌ `rm -rf /tmp/*` 危险删除
- ❌ `chmod 777` 修改权限

#### 3. 命令执行 (CMD001)
- ❌ 使用 `sudo` 命令
- ❌ 执行 `rm -rf` 危险操作
- ❌ 使用 `dd` 命令

#### 4. 代码注入 (INJ001, INJ003)
- ❌ 在 Python 文件中注入后门代码
- ❌ 建立 reverse shell (`bash -i >& /dev/tcp/`)
- ❌ 使用 `nc -e` 建立连接

### 🟡 WARNING 级别（警告）

#### 5. 系统命令调用 (CMD002)
- ⚠️ 使用 `os.system()`
- ⚠️ 使用 `subprocess` with `shell=True`
- ⚠️ 使用 `eval()` 和 `exec()`

#### 6. 动态代码执行 (INJ002)
- ⚠️ `eval(user_input)`
- ⚠️ `exec(user_input)`
- ⚠️ `__import__()` 动态导入

#### 7. 依赖安全 (DEP001, DEP002)
- ⚠️ `pip install --global` 全局安装
- ⚠️ `--force-reinstall` 强制覆盖
- ⚠️ 指定特定版本覆盖现有包

#### 8. 代码混淆 (OBF001, OBF002)
- ⚠️ `base64.b64decode()` 混淆
- ⚠️ `getattr()` 间接调用
- ⚠️ `vars()` 动态访问

## 测试扫描

使用 skill-security-scan 扫描此 Skill：

```bash
# 扫描恶意示例
python -m src.cli scan tests/skills/malicious_skills/data-optimizer

# 应该检测到多个严重安全问题
```

## 预期输出

```
🔍 Scanning Skill: tests/skills/malicious_skills/data-optimizer
⚠️  Risk Level: CRITICAL (10/10)

🔴 CRITICAL Issues (15+):
  [NET001] External network request detected
  [NET002] Data exfiltration detected
  [FILE001] Sensitive file access detected
  [FILE002] Dangerous file operation
  [CMD001] Dangerous command execution
  [INJ001] Code injection detected
  [INJ003] Backdoor implantation detected
  ...

💡 Recommendation: DO NOT USE THIS SKILL
```

## 攻击流程

```
1. 用户安装 Skill
2. 运行 setup.sh 脚本
3. 脚本执行以下操作：
   - 读取敏感文件（SSH 密钥、环境变量）
   - 发送到攻击者服务器
   - 建立 reverse shell
   - 注入后门代码
   - 实现持久化（修改 .bashrc）
   - 全局安装恶意包
4. 攻击者获得系统访问权限
5. 数据持续泄露
```

## 防御建议

1. ✅ 使用 skill-security-scan 扫描所有 Skills
2. ✅ 不执行来源不明的脚本
3. ✅ 审查 Skill 的所有代码文件
4. ✅ 在隔离环境中测试
5. ✅ 监控网络流量
6. ✅ 定期检查系统启动脚本
7. ✅ 使用版本控制系统便于回滚

## 教育价值

这些示例展示了：
- ✅ 常见的攻击模式
- ✅ 如何识别恶意代码
- ✅ 安全扫描工具的重要性
- ✅ 防御措施和最佳实践

---

**免责声明**: 这些代码仅用于安全测试和教育目的。请勿在未经授权的系统上使用！
