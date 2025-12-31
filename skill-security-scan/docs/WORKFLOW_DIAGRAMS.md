# Skill-Security-Scanner 业务执行逻辑

> 版本: 1.0.0
> 更新时间: 2024-12-29
> 作者: Skill-Security-Scanner Team

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户层                                │
│                 命令行 / 中文 / 英文                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      CLI 接口层                              │
│  (src/cli.py)                                               │
│  - 多路径扫描处理                                            │
│  - 国际化支持 (i18n)                                         │
│  - 格式选择 (HTML/Console/JSON)                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ConfigLoader │  │ RulesFactory │  │ SecurityDet. │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      扫描引擎层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Parser     │  │  Analyzer    │  │   Detector   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      规则检测层                              │
│  Network / FileOps / Injection / Command / Dependencies     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      报告生成层                              │
│  HTMLReporter (默认) / ConsoleReporter / JSONReporter       │
│  - Tailwind CSS + Font Awesome CDN                          │
│  - 响应式设计                                                │
│  - 交互式筛选                                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      输出层                                  │
│  Console (摘要) + HTML File (详细报告)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心业务流程图

### 2.1 主流程

```
开始
  ↓
初始化国际化 (i18n) - 加载语言包 (中文/英文)
  ↓
用户输入命令 (scan / report / whitelist)
  ↓
[扫描命令处理]
  ├─ 收集扫描路径
  │  ├─ 未指定路径 → 当前目录 + .claude/skills/
  │  └─ 指定路径 → 指定路径 + .claude/skills/
  ├─ 路径去重
  └─ 验证路径存在
  ↓
加载配置文件 (config.yaml)
  ↓
加载检测规则 (rules.yaml)
  ↓
加载白名单 (whitelist.yaml)
  ↓
创建规则实例 (RulesFactory)
  ↓
创建检测器 (SecurityDetector)
  ↓
[多路径扫描]
  对于每个扫描路径:
    ├─ 显示: "正在扫描: {path}"
    ├─ 解析 Skill 目录 (SkillParser)
    │  ├─ 收集文件列表
    │  ├─ 提取元数据
    │  └─ 过滤排除目录
    ├─ 扫描文件 (SecurityDetector)
    │  ├─ 遍历每个文件
    │  ├─ 读取文件内容
    │  ├─ 应用所有规则
    │  └─ 收集发现结果
    └─ 收集报告
  ↓
[合并报告]
  ├─ 多路径报告合并
  ├─ 重新计算风险分数
  └─ 统计总数
  ↓
过滤低级别问题 (如果指定 --severity)
  ↓
生成报告 (Reporters)
  ├─ 始终生成控制台摘要
  ├─ 根据格式生成主报告:
  │  ├─ HTML (默认):
  │  │  ├─ 加载对应语言包
  │  │  ├─ 生成 HTML + Tailwind CSS
  │  │  ├─ 自动文件名 (时间戳)
  │  │  └─ 保存到文件
  │  ├─ Console:
  │  │  └─ 仅显示控制台输出
  │  └─ JSON:
  │     └─ 保存 JSON 到文件
  └─ 计算风险分数、等级、统计
  ↓
输出结果
  ├─ 始终显示: 控制台扫描摘要
  └─ 根据格式显示:
     ├─ HTML: "Report saved to: {file}"
     ├─ JSON: "Report saved to: {file}"
     └─ Console: 控制台完整报告
  ↓
检查退出码 (--fail-on)
  ├─ 满足条件 → exit(1)
  └─ 正常 → exit(0)
  ↓
结束
```

---

### 2.2 扫描详细流程

```
SecurityDetector.scan(skill_path)
  ↓
SkillParser.parse(skill_path)
  ├─ 验证路径存在
  ├─ 遍历目录树
  ├─ 过滤文件类型
  │  ├─ 排除: .git, node_modules, __pycache__
  │  └─ 包含: .py, .md, .sh, .yaml, .json
  ├─ 收集文件列表
  └─ 提取元数据
     └─ 解析 SKILL.md (如有)
  ↓
对于每个文件:
  ↓
  SkillAnalyzer.analyze_file(file_path, content)
    ↓
    对于每个规则:
      ↓
      跳过白名单规则?
      ├─ Yes → 跳过
      └─ No  ↓
           ↓
      SecurityRule.match(content)
        ├─ 编译正则表达式
        ├─ 逐行匹配
        ├─ 计算置信度
        └─ 返回 Match 列表
           ↓
      创建 Finding 对象
        ├─ rule_id
        ├─ severity
        ├─ file_path
        ├─ line_number
        ├─ pattern
        ├─ description
        └─ confidence
    ↓
    收集所有 Findings
  ↓
所有文件扫描完成
  ↓
SkillAnalyzer.generate_report()
  ├─ 统计各级别问题数
  │  ├─ CRITICAL
  │  ├─ WARNING
  │  └─ INFO
  ├─ 计算风险分数
  │  └─ 权重: CRITICAL=10, WARNING=4, INFO=1
  ├─ 确定风险等级
  │  ├─ 8-10: CRITICAL
  │  ├─ 6-7:  HIGH
  │  ├─ 4-5:  MEDIUM
  │  ├─ 2-3:  LOW
  │  └─ 0-1:  SAFE
  └─ 生成建议
  ↓
返回完整报告
```

---

## 三、时序图

### 3.1 完整扫描时序图

```
用户    CLI    ConfigLoader    RulesFactory    SecurityDetector    SkillParser    SkillAnalyzer    SecurityRule    Reporter
 │       │          │               │                │               │              │               │            │
 │ scan  │          │               │                │               │              │               │            │
 ├──────>│          │               │                │               │              │               │            │
 │       │ load()   │               │                │               │              │               │            │
 │       ├─────────>│               │                │               │              │               │            │
 │       │          │ load YAML     │                │               │              │               │            │
 │       │<─────────┤               │                │               │              │               │            │
 │       │          │               │                │               │              │               │            │
 │       │ load_rules()             │                │               │              │               │            │
 │       ├─────────────────────────>│                │               │              │               │            │
 │       │                          │ create_rules()│               │              │               │            │
 │       │<─────────────────────────┤                │               │              │               │            │
 │       │                          │                │               │              │               │            │
 │       │ new SecurityDetector()    │                │               │              │               │            │
 │       ├──────────────────────────────────────────>│               │              │               │            │
 │       │                          │                │               │              │               │            │
 │       │ scan(path)               │                │               │              │               │            │
 │       ├──────────────────────────────────────────┼──────────────>│              │               │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │ parse()      │               │            │
 │       │                          │                │               ├──────────────>│              │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │ collect files│               │            │
 │       │                          │                │               │<─────────────┤               │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │ parse files  │               │            │
 │       │                          │                │<──────────────┤               │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │ analyze_files │              │               │            │
 │       ├──────────────────────────┼───────────────┼───────────────┼──────────────>│              │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │   for each file              │            │
 │       │                          │                │               │              │ analyze_file()│            │
 │       │                          │                │               │              ├──────────────>│            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │              │   for each rule│            │
 │       │                          │                │               │              │               │ match()    │
 │       │                          │                │               │              ├───────────────┼──────────>│
 │       │                          │                │               │              │               │            │
 │       │                          │                │               │              │               │ regex match│
 │       │                          │                │               │              │<──────────────┼────────────┤
 │       │                          │                │               │              │ Finding list  │            │
 │       │                          │                │               │<─────────────┤               │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │<──────────────┼──────────────┤               │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │ generate_report│             │               │            │
 │       ├──────────────────────────┼───────────────┼───────────────┼──────────────>│              │            │
 │       │                          │                │               │              │               │            │
 │       │                          │                │<──────────────┼──────────────┤               │            │
 │       │                          │                │   report      │              │               │            │
 │       │                          │                │               │              │               │            │
 │       │ generate(report)          │                │               │              │               │            │
 │       ├──────────────────────────────────────────┼───────────────┼──────────────┼──────────────┼────────────┼──────>
 │       │                          │                │               │              │               │            │
 │       │<─────────────────────────┼───────────────┼───────────────┼──────────────┼──────────────┼────────────┤
 │       │ formatted report          │                │               │              │               │            │
 │<──────┤                          │                │               │              │               │            │
 │       │                          │                │               │              │               │            │
```

---

### 3.2 规则匹配时序图

```
SkillAnalyzer    SecurityRule    Regex Engine    Finding
    │                 │                │            │
    │ match(content)  │                │            │
    ├────────────────>│                │            │
    │                 │                │            │
    │                 │ split lines    │            │
    │                 ├───────────────>│            │
    │                 │                │            │
    │                 │ for each line: │            │
    │                 │                │            │
    │                 │ search(pattern)│            │
    │                 ├───────────────>│            │
    │                 │                │            │
    │                 │    match/no match            │
    │                 │<───────────────┤            │
    │                 │                │            │
    │                 │ if matched:    │            │
    │                 │                │            │
    │                 │ calc_confidence()            │
    │                 ├───────────────>│            │
    │                 │<───────────────┤            │
    │                 │                │            │
    │                 │ create Match() │            │
    │                 ├────────────────────────────>│
    │                 │                │            │
    │                 │ collect all Match│          │
    │                 │<────────────────────────────┤
    │                 │                │            │
    │ Match list      │                │            │
    │<────────────────┤                │            │
    │                 │                │            │
    │ create Finding()│                │            │
    ├────────────────────────────────────────────>│
    │                 │                │            │
```

---

## 四、数据流图

### 4.1 数据流转

```
输入: Skill 路径 (多个)
  ↓
[国际化数据]
  ├─ 语言设置 (--lang)
  ├─ zh_CN / en_US
  └─ i18n 模块加载翻译包
  ↓
[配置数据]
  ├─ config.yaml → ConfigLoader → 配置字典
  ├─ rules.yaml → ConfigLoader → 规则列表
  └─ whitelist.yaml → ConfigLoader → 白名单列表
  ↓
[路径处理]
  ├─ 默认路径: . + .claude/skills/
  ├─ 用户路径: [path1, path2, ...]
  ├─ 自动添加: .claude/skills/
  ├─ 去重排序
  └─ 验证存在性
  ↓
[文件数据]
  ├─ SkillParser.parse() × N (多路径)
  ├─ 收集文件路径列表
  ├─ 读取文件内容
  └─ 解析 SKILL.md 元数据
  ↓
[扫描数据]
  ├─ 遍历文件列表
  ├─ 对于每个文件:
  │  ├─ 读取内容
  │  ├─ 应用所有规则
  │  └─ 生成 Finding 列表
  └─ 汇总所有 Finding
  ↓
[多报告合并]
  ├─ 收集多个路径的报告
  ├─ 合并 findings
  ├─ 合并统计数据
  └─ 重新计算风险分数
  ↓
[分析数据]
  ├─ 按严重级别分组
  ├─ 统计各级别数量
  ├─ 计算风险分数
  └─ 确定风险等级
  ↓
[报告数据]
  ├─ ConsoleReporter → 彩色文本 (ASCII 图标)
  ├─ JSONReporter → JSON 字符串
  └─ HTMLReporter → HTML + Tailwind CSS + CDN
     ├─ 翻译字典 (中文/英文)
     ├─ 响应式布局
     └─ 交互式组件
  ↓
输出: 双重输出
  ├─ Console (摘要) - 始终显示
  └─ File (HTML/JSON) - 根据格式
```

---

### 4.2 核心数据结构

```
Config (配置)
{
  "scanner": {
    "max_file_size": 52428800,
    "exclude_patterns": [...],
    "scan_extensions": [...]
  },
  "rules": {
    "rules_file": "config/rules.yaml",
    "whitelist_file": "config/whitelist.yaml"
  }
}

Rule (规则)
{
  "id": "NET001",
  "name": "外部网络请求",
  "severity": "CRITICAL",
  "patterns": ["curl\\s+.*http", ...],
  "description": "检测网络请求",
  "allowed_domains": [...]
}

Finding (发现)
{
  "rule_id": "NET001",
  "severity": "CRITICAL",
  "file": "SKILL.md",
  "line": 15,
  "pattern": "curl -X POST https://...",
  "description": "检测网络请求",
  "confidence": 0.95
}

Report (报告)
{
  "scan_id": "scan_20241229_143052",
  "timestamp": "2024-12-29T14:30:52Z",
  "skill_path": "/path/to/skill",
  "risk_score": 8.5,
  "risk_level": "HIGH",
  "summary": {
    "CRITICAL": 3,
    "WARNING": 2,
    "INFO": 1
  },
  "findings": [...],
  "total_issues": 6,
  "total_files": 15,
  "scanned_paths": ["/path/to/skill1", "/path/to/skill2"],
  "scanned_paths_count": 2
}

Translation (翻译 - i18n)
{
  "zh_CN": {
    "scan_summary": "扫描摘要",
    "total_files": "文件总数",
    "risk_level": "风险等级",
    ...
  },
  "en_US": {
    "scan_summary": "Scan Summary",
    "total_files": "Total Files",
    "risk_level": "Risk Level",
    ...
  }
}
```

---

## 五、关键业务逻辑

### 5.1 风险评分算法

```
风险分数计算:

1. 定义权重:
   CRITICAL: 10 分
   WARNING:   4 分
   INFO:      1 分

2. 计算总分:
   total_score = Σ(finding.severity_weight × finding.confidence)

3. 归一化 (0-10):
   max_score = 20 个问题 × 10 分 × 1.0 置信度 = 200
   normalized = (total_score / max_score) × 10
   risk_score = min(normalized, 10.0)

4. 确定等级:
   8-10: CRITICAL
   6-7:  HIGH
   4-5:  MEDIUM
   2-3:  LOW
   0-1:  SAFE
```

### 5.2 规则匹配逻辑

```
1. 编译正则:
   compiled_patterns = [re.compile(p, re.IGNORECASE) for p in patterns]

2. 逐行匹配:
   for line_number, line in enumerate(content.split('\n'), 1):
       for pattern in compiled_patterns:
           if pattern.search(line):
               # 发现匹配

3. 计算置信度:
   base_confidence = 0.7
   if line contains '#': base_confidence -= 0.2
   if line contains suspicious_keywords: base_confidence += 0.2
   confidence = clamp(base_confidence, 0.0, 1.0)

4. 创建 Match:
   Match(line_number, line.strip(), confidence)
```

### 5.3 文件过滤逻辑

```
1. 排除目录:
   exclude_dirs = {'.git', '__pycache__', 'node_modules', ...}

2. 扫描扩展名:
   scan_extensions = {'.py', '.md', '.sh', '.yaml', ...}

3. 收集文件:
   for root, dirs, files in os.walk(path):
       # 过滤目录
       dirs[:] = [d for d in dirs if d not in exclude_dirs]

       for filename in files:
           filepath = Path(root) / filename

           # 检查扩展名或特殊文件
           if (filename == 'SKILL.md' or
               filepath.suffix in scan_extensions):
               files.append(filepath)
```

---

## 六、HTML 报告生成器架构

### 6.1 HTMLReporter 组件

```
HTMLReporter 初始化
  ↓
设置语言 (zh_CN / en_US)
  ↓
加载翻译字典
  ├─ 中文: 所有界面文本
  └─ 英文: 所有界面文本
  ↓
生成 HTML 报告
  ├─ HTML 头部
  │  ├─ UTF-8 编码
  │  ├─ Tailwind CSS (CDN)
  │  ├─ Font Awesome (CDN)
  │  └─ 自定义 CSS 样式
  ├─ 主体内容
  │  ├─ 风险仪表板
  │  │  ├─ 风险等级卡片
  │  │  ├─ 风险分数
  │  │  └─ 统计摘要
  │  ├─ 问题列表
  │  │  ├─ 筛选按钮 (CRITICAL/WARNING/INFO)
  │  │  └─ 问题卡片
  │  │     ├─ 可折叠详情
  │  │     ├─ 代码高亮
  │  │     └─ 置信度标签
  │  └─ 扫描信息
  │     ├─ 扫描路径列表
  │     ├─ 文件统计
  │     └─ 时间戳
  ├─ JavaScript 交互
  │  ├─ 筛选功能
  │  ├─ 折叠/展开
  │  └─ 动态更新统计
  └─ HTML 尾部
  ↓
返回完整 HTML 字符串
```

### 6.2 响应式设计

```
桌面布局 (>= 1024px)
  ├─ 双列网格
  ├─ 左侧: 统计仪表板
  └─ 右侧: 问题列表

平板布局 (768px - 1023px)
  ├─ 单列堆叠
  ├─ 仪表板在上
  └─ 问题列表在下

移动布局 (< 768px)
  ├─ 单列紧凑
  ├─ 简化统计
  └─ 全宽问题卡片
```

### 6.3 交互功能

```
1. 筛选功能
   ├─ 点击 "CRITICAL" → 仅显示严重问题
   ├─ 点击 "WARNING" → 仅显示警告问题
   ├─ 点击 "INFO" → 仅显示提示
   └─ 点击 "ALL" → 显示全部

2. 折叠功能
   ├─ 默认: 展开前 3 个问题
   ├─ 点击卡片: 折叠/展开详情
   └─ "展开全部" / "折叠全部" 按钮

3. 统计更新
   ├─ 筛选后自动更新问题计数
   └─ 动态显示可见问题数
```

---

## 七、国际化 (i18n) 架构

### 7.1 翻译流程

```
用户启动
  ↓
检测语言设置
  ├─ --lang 参数
  ├─ 系统环境变量
  └─ 默认: zh_CN
  ↓
初始化 i18n
  ├─ init_i18n(lang)
  ├─ 加载 .mo 文件
  └─ 设置翻译函数 _()
  ↓
CLI 层翻译
  ├─ 帮助文本
  ├─ 错误消息
  └─ 状态提示
  ↓
Reporter 层翻译
  ├─ ConsoleReporter: 使用 _()
  └─ HTMLReporter: 使用内置翻译字典
  ↓
输出已翻译内容
```

### 7.2 翻译文件结构

```
src/i18n/
├── __init__.py              # i18n 模块初始化
│   ├── SUPPORTED_LANGUAGES  # 支持的语言列表
│   ├── DEFAULT_LANGUAGE     # 默认语言
│   ├── init_i18n()          # 初始化函数
│   ├── get_language()       # 获取当前语言
│   └── _()                  # 翻译函数
├── zh_CN/                   # 中文翻译
│   └── LC_MESSAGES/
│       ├── skill_scan.po    # 翻译源文件
│       └── skill_scan.mo    # 编译后的翻译
└── en_US/                   # 英文翻译
    └── LC_MESSAGES/
        ├── skill_scan.po
        └── skill_scan.mo
```

---

## 八、多路径扫描架构

### 8.1 路径收集策略

```
用户输入路径
  ↓
策略 1: 未指定路径
  ├─ 添加: "." (当前目录)
  ├─ 检查: .claude/skills/ 是否存在
  └─ 存在则添加

策略 2: 指定路径
  ├─ 添加: 用户指定的所有路径
  └─ 强制添加: .claude/skills/ (如果存在)

路径去重
  ├─ 转换为绝对路径
  ├─ 去除重复项
  └─ 保持顺序

验证路径
  ├─ 检查路径是否存在
  └─ 不存在则跳过 (显示警告)
```

### 8.2 报告合并策略

```
扫描路径 1
  ├─ 生成报告 1
  └─ findings: [f1, f2, f3]
  ↓
扫描路径 2
  ├─ 生成报告 2
  └─ findings: [f4, f5]
  ↓
合并报告
  ├─ findings: [f1, f2, f3, f4, f5]
  ├─ total_files: file_count_1 + file_count_2
  ├─ scanned_paths: [path1, path2]
  └─ scanned_paths_count: 2
  ↓
重新计算风险分数
  ├─ 统计各级别数量
  ├─ 应用风险算法
  └─ 生成最终报告
```

---

## 九、异常处理流程

```
开始扫描
  ↓
捕获异常
  ↓
异常类型判断
  ├─ FileNotFoundError
  │  └─ 输出: "Skill path not found"
  │     └─ 退出码: 1
  │
  ├─ PermissionError
  │  └─ 输出: "Permission denied"
  │     └─ 继续扫描其他文件
  │
  ├─ UnicodeDecodeError
  │  └─ 输出: "Warning: Could not read file (encoding)"
  │     └─ 跳过该文件，继续
  │
  ├─ YAML Parse Error
  │  └─ 输出: "Error loading configuration"
  │     └─ 使用默认配置
  │
  └─ 其他异常
     └─ 输出: "Error: {message}"
        └─ 退出码: 1
```

---

## 七、性能优化点

### 7.1 并发扫描（未来）

```
当前: 串行扫描
  file1 → file2 → file3 → ...

优化: 并发扫描
  ┌─────────┐
  │ ThreadPool│
  └────┬────┘
       │
    ┌──┼──┬──┐
    ↓  ↓  ↓  ↓
  f1  f2  f3  f4
```

### 7.2 规则缓存（未来）

```
当前: 每次扫描都编译正则
  scan1 → compile regex → scan
  scan2 → compile regex → scan

优化: 缓存编译后的正则
  scan1 → compile regex → cache
  scan2 → use cached regex → scan
```

---

## 十、总结

### 核心流程

```
用户命令 → 国际化初始化 → 加载配置 → 多路径处理 →
解析 Skill → 扫描文件 → 匹配规则 → 合并报告 →
双重输出 (Console + HTML/JSON)
```

### 关键组件

1. **i18n** - 国际化模块 (中文/英文)
2. **ConfigLoader** - 配置管理
3. **RulesFactory** - 规则实例化
4. **SecurityDetector** - 主控制器
5. **SkillParser** - 文件解析
6. **SkillAnalyzer** - 代码分析
7. **SecurityRule** - 规则匹配
8. **ConsoleReporter** - 控制台输出 (ASCII 图标)
9. **HTMLReporter** - HTML 报告 (Tailwind CSS + Font Awesome)
10. **JSONReporter** - JSON 报告

### 新增特性 (v1.0.0)

- ✅ **国际化支持** - 中文和英文界面
- ✅ **HTML 默认报告** - 美观的可视化报告
- ✅ **多路径扫描** - 自动扫描多个目录
- ✅ **智能路径处理** - 自动包含 `.claude/skills/`
- ✅ **双重输出** - 控制台摘要 + 详细报告文件
- ✅ **响应式设计** - 支持桌面/平板/移动端
- ✅ **交互式筛选** - 按严重级别筛选问题

### 数据流

```
国际化数据 → 配置数据 → 多路径数据 → 文件数据 →
扫描数据 → 多报告合并 → 分析数据 → 双重输出数据
```

---

这个业务逻辑设计保证了：
- ✅ 模块化清晰
- ✅ 易于扩展
- ✅ 易于测试
- ✅ 性能可优化
- ✅ 用户友好 (i18n + HTML)
- ✅ 灵活配置 (多路径 + 多格式)
