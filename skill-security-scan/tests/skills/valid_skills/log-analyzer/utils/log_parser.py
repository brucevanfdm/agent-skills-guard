"""
日志解析工具 - 纯 Python 实现，无安全隐患

这是一个辅助工具，用于解析和分析日志文件。
不执行任何系统命令，不访问网络，不读取敏感文件。
"""
import re
from datetime import datetime
from typing import List, Dict, Any
from collections import Counter


class LogParser:
    """日志解析器"""

    # 常见的错误模式
    ERROR_PATTERNS = [
        r'ERROR',
        r'EXCEPTION',
        r'CRITICAL',
        r'FATAL',
        r'Traceback',
        r'\b5\d\d\b',  # HTTP 5xx 错误
    ]

    WARNING_PATTERNS = [
        r'WARNING',
        r'WARN',
        r'\b4\d\d\b',  # HTTP 4xx 错误
    ]

    def __init__(self, log_content: str):
        """
        初始化解析器

        Args:
            log_content: 日志文件内容
        """
        self.log_content = log_content
        self.lines = log_content.split('\n')

    def analyze(self) -> Dict[str, Any]:
        """
        分析日志内容

        Returns:
            分析结果字典
        """
        return {
            'total_lines': len(self.lines),
            'errors': self._find_errors(),
            'warnings': self._find_warnings(),
            'error_stats': self._get_error_stats(),
        }

    def _find_errors(self) -> List[Dict[str, Any]]:
        """查找所有错误"""
        errors = []

        for i, line in enumerate(self.lines, 1):
            if any(re.search(pattern, line, re.IGNORECASE)
                   for pattern in self.ERROR_PATTERNS):
                errors.append({
                    'line_number': i,
                    'content': line.strip(),
                    'timestamp': self._extract_timestamp(line)
                })

        return errors

    def _find_warnings(self) -> List[Dict[str, Any]]:
        """查找所有警告"""
        warnings = []

        for i, line in enumerate(self.lines, 1):
            if any(re.search(pattern, line, re.IGNORECASE)
                   for pattern in self.WARNING_PATTERNS):
                warnings.append({
                    'line_number': i,
                    'content': line.strip()
                })

        return warnings

    def _get_error_stats(self) -> Dict[str, int]:
        """获取错误统计"""
        error_types = []

        for line in self.lines:
            # 提取常见错误类型
            if 'ConnectionError' in line:
                error_types.append('ConnectionError')
            elif 'TimeoutError' in line:
                error_types.append('TimeoutError')
            elif 'ValueError' in line:
                error_types.append('ValueError')
            elif 'KeyError' in line:
                error_types.append('KeyError')
            elif any(re.search(p, line, re.IGNORECASE)
                    for p in self.ERROR_PATTERNS):
                error_types.append('OtherError')

        return dict(Counter(error_types))

    def _extract_timestamp(self, line: str) -> str:
        """提取时间戳"""
        # 常见的时间戳格式
        patterns = [
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}',
            r'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}',
            r'\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}',
        ]

        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group()

        return "Unknown"

    def generate_report(self) -> str:
        """生成 Markdown 格式的报告"""
        analysis = self.analyze()

        report = []
        report.append("# 日志分析报告\n")
        report.append(f"**总行数**: {analysis['total_lines']}\n")
        report.append(f"**错误数**: {len(analysis['errors'])}\n")
        report.append(f"**警告数**: {len(analysis['warnings'])}\n")

        report.append("\n## 错误统计\n")
        for error_type, count in analysis['error_stats'].items():
            report.append(f"- {error_type}: {count}")

        report.append("\n## Top 错误\n")
        for error in analysis['errors'][:10]:
            report.append(
                f"**行 {error['line_number']}**: {error['content'][:100]}..."
            )

        return '\n'.join(report)


def main():
    """示例用法"""
    sample_log = """
2024-12-29 10:15:23 INFO Application started
2024-12-29 10:15:24 ERROR Database connection failed
2024-12-29 10:15:25 WARNING Retrying connection
2024-12-29 10:15:26 INFO Connection established
2024-12-29 10:15:27 ERROR TimeoutError: Query took too long
2024-12-29 10:15:28 WARNING Cache miss
"""

    parser = LogParser(sample_log)
    print(parser.generate_report())


if __name__ == '__main__':
    main()
