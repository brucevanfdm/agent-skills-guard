"""
JSON 报告生成器
"""
import json
from typing import Dict, Any
from datetime import datetime


class JSONReporter:
    """JSON 报告生成器"""

    def __init__(self, indent: int = 2):
        """
        初始化报告生成器

        Args:
            indent: JSON 缩进空格数
        """
        self.indent = indent

    def generate(self, report: Dict[str, Any]) -> str:
        """
        生成 JSON 报告

        Args:
            report: 扫描报告

        Returns:
            str: JSON 格式的报告
        """
        # 添加元数据
        json_report = {
            'scan_id': f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            'timestamp': datetime.now().isoformat() + 'Z',
            'skill_path': report.get('skill_path'),
            'skill_name': report.get('skill_name'),
            'risk_score': report.get('risk_score', 0),
            'risk_level': report.get('risk_level', 'UNKNOWN'),
            'total_files': report.get('total_files', 0),
            'summary': report.get('summary', {}),
            'issues': report.get('findings', []),
            'total_issues': report.get('total_issues', 0),
            'recommendation': self._get_recommendation(
                report.get('risk_level')
            )
        }

        return json.dumps(json_report, indent=self.indent, ensure_ascii=False)

    def _get_recommendation(self, risk_level: str) -> str:
        """获取推荐文本"""
        recommendations = {
            'CRITICAL': 'DO_NOT_USE',
            'HIGH': 'NOT_RECOMMENDED',
            'MEDIUM': 'REVIEW_NEEDED',
            'LOW': 'USE_WITH_CAUTION',
            'SAFE': 'SAFE'
        }
        return recommendations.get(risk_level, 'UNKNOWN')
