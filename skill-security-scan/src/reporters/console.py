"""
控制台报告生成器
"""
from typing import Dict, Any
from datetime import datetime

from ..i18n import _


class ConsoleReporter:
    """控制台报告生成器"""

    # 颜色代码
    COLORS = {
        'red': '\033[91m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'green': '\033[92m',
        'reset': '\033[0m',
        'bold': '\033[1m'
    }

    # 风险等级图标
    ICONS = {
        'CRITICAL': '[!]',
        'HIGH': '[!!]',
        'WARNING': '[*]',
        'INFO': '[i]',
        'SAFE': '[OK]'
    }

    def __init__(self, use_color: bool = True):
        """
        初始化报告生成器

        Args:
            use_color: 是否使用彩色输出
        """
        self.use_color = use_color

    def generate(self, report: Dict[str, Any]) -> str:
        """
        生成控制台报告

        Args:
            report: 扫描报告

        Returns:
            str: 格式化的报告文本
        """
        lines = []

        # 标题 - 如果是多个路径，显示所有路径
        if 'scanned_paths' in report and report['scanned_paths']:
            lines.append(self._colorize(_('[*] Scanning Skills:'), 'bold'))
            for path in report['scanned_paths']:
                lines.append(f"  - {path}")
            lines.append('')
        else:
            lines.append(self._colorize(_('[*] Scanning Skill: '), 'bold') +
                        report.get('skill_path', 'Unknown'))
            lines.append('')

        # 风险等级
        risk_level = report.get('risk_level', 'UNKNOWN')
        risk_score = report.get('risk_score', 0)
        icon = self.ICONS.get(risk_level, '[?]')
        lines.append(_("{icon} Risk Level: {level} ({score:.1f}/10)").format(
            icon=icon, level=risk_level, score=risk_score))
        lines.append('')

        # 按严重级别分组
        findings_by_severity = self._group_by_severity(
            report.get('findings', [])
        )

        # 显示各级别问题
        for severity in ['CRITICAL', 'WARNING', 'INFO']:
            if severity not in findings_by_severity:
                continue

            findings = findings_by_severity[severity]
            icon = self.ICONS.get(severity, '[*]')

            lines.append(self._colorize(
                _("{icon} {severity} Issues ({count}):").format(
                    icon=icon, severity=severity, count=len(findings)),
                self._get_severity_color(severity)
            ))

            for finding in findings[:10]:  # 限制显示数量
                lines.append(self._format_finding(finding))

            if len(findings) > 10:
                lines.append(_("  and {count} more").format(count=len(findings) - 10))

            lines.append('')

        # 统计摘要
        lines.append(_('[*] Summary:'))
        lines.append(_("  Total Files Scanned: {count}").format(count=report.get('total_files', 0)))
        summary = report.get('summary', {})
        lines.append(_("  Critical Issues: {count}").format(count=summary.get('CRITICAL', 0)))
        lines.append(_("  Warning Issues: {count}").format(count=summary.get('WARNING', 0)))
        lines.append(_("  Info Issues: {count}").format(count=summary.get('INFO', 0)))
        lines.append(_("  Total Issues: {count}").format(count=report.get('total_issues', 0)))
        lines.append('')

        # 建议
        recommendation = self._get_recommendation_text(risk_level)
        lines.append(self._colorize(_('[*] Recommendation: {recommendation}').format(
            recommendation=recommendation), self._get_severity_color(risk_level)))

        return '\n'.join(lines)

    def _group_by_severity(self, findings: list) -> Dict[str, list]:
        """按严重级别分组"""
        grouped = {}
        for finding in findings:
            severity = finding.get('severity', 'INFO')
            if severity not in grouped:
                grouped[severity] = []
            grouped[severity].append(finding)
        return grouped

    def _format_finding(self, finding: Dict[str, Any]) -> str:
        """格式化单个发现"""
        rule_id = finding.get('rule_id', 'UNKNOWN')
        file = finding.get('file', 'Unknown')
        line = finding.get('line', 0)
        pattern = finding.get('pattern', '')
        confidence = finding.get('confidence', 0)

        # 限制模式长度
        if len(pattern) > 80:
            pattern = pattern[:77] + '...'

        lines = [
            _("  [{rule_id}] in {file}:{line}").format(rule_id=rule_id, file=file, line=line),
            _("    Pattern: {pattern}").format(pattern=pattern),
            _("    Confidence: {confidence}").format(confidence=self._get_confidence_label(confidence))
        ]

        return '\n'.join(lines)

    def _get_confidence_label(self, confidence: float) -> str:
        """获取置信度标签"""
        if confidence >= 0.9:
            return _('HIGH')
        elif confidence >= 0.7:
            return _('MEDIUM')
        else:
            return _('LOW')

    def _get_severity_color(self, severity: str) -> str:
        """获取严重级别对应的颜色"""
        color_map = {
            'CRITICAL': 'red',
            'HIGH': 'red',
            'WARNING': 'yellow',
            'INFO': 'blue',
            'SAFE': 'green'
        }
        return color_map.get(severity, 'reset')

    def _get_recommendation_text(self, risk_level: str) -> str:
        """获取推荐文本"""
        recommendations = {
            'CRITICAL': _('DO NOT USE THIS SKILL - 检测到严重安全风险'),
            'HIGH': _('NOT RECOMMENDED - 检测到高风险问题'),
            'MEDIUM': _('REVIEW NEEDED - 请人工审查后使用'),
            'LOW': _('USE WITH CAUTION - 存在轻微风险'),
            'SAFE': _('SAFE - 未检测到明显安全问题')
        }
        return recommendations.get(risk_level, 'UNKNOWN RISK LEVEL')

    def _colorize(self, text: str, color: str) -> str:
        """给文本添加颜色"""
        if not self.use_color:
            return text

        color_code = self.COLORS.get(color, '')
        reset_code = self.COLORS['reset']

        return f"{color_code}{text}{reset_code}"
