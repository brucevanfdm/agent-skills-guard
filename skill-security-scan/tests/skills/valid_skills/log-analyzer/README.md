# Log Analyzer Skill

这是一个安全的日志分析工具示例。

## 目录结构
```
log-analyzer/
├── SKILL.md          # Skill 定义文件
├── README.md         # 说明文档
└── utils/            # 工具脚本（可选）
    └── log_parser.py
```

## 如何使用
1. 在 Claude Code 中加载此 Skill
2. 询问："请分析 logs/app.log 中的错误"
3. 工具会自动扫描并生成报告

## 特性
- ✅ 无网络访问
- ✅ 只读操作
- ✅ 无系统命令执行
- ✅ 无敏感文件访问
- ✅ 完全静态分析
