"""
测试 Skill 扫描器
使用真实的 Skill 示例进行测试
"""
import pytest
from pathlib import Path

from src.config_loader import ConfigLoader
from src.rules_factory import RulesFactory
from src.scanner import SecurityDetector


class TestSkillsScanner:
    """测试 Skill 扫描器"""

    @pytest.fixture
    def rules(self):
        """加载测试规则"""
        config_loader = ConfigLoader()
        config_loader.load()
        rules_list = config_loader.load_rules()
        return RulesFactory.create_rules(rules_list)

    @pytest.fixture
    def detector(self, rules):
        """创建检测器"""
        return SecurityDetector(rules)

    def test_scan_valid_skill(self, detector):
        """测试扫描安全的 Skill"""
        valid_skill_path = Path('tests/skills/valid_skills/log-analyzer')

        report = detector.scan(str(valid_skill_path))

        print(report)

    def test_scan_malicious_skill(self, detector):
        """测试扫描恶意 Skill"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        print(report)

    def test_detect_network_exfiltration(self, detector):
        """测试检测数据外传"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        # 应该检测到 NET002（数据外传）
        net002_findings = [
            f for f in report['findings']
            if f['rule_id'] == 'NET002'
        ]

        assert len(net002_findings) > 0

    def test_detect_sensitive_file_access(self, detector):
        """测试检测敏感文件访问"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        # 应该检测到 FILE001（敏感文件访问）
        file001_findings = [
            f for f in report['findings']
            if f['rule_id'] == 'FILE001'
        ]

        assert len(file001_findings) > 0

        # 验证检测到的敏感文件
        patterns = ' '.join([f['pattern'] for f in file001_findings])
        assert any(keyword in patterns.lower() for keyword in
                   ['.ssh', '.env', 'id_rsa', 'credentials'])

    def test_detect_code_injection(self, detector):
        """测试检测代码注入"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        # 应该检测到 INJ003（后门植入）
        inj003_findings = [
            f for f in report['findings']
            if f['rule_id'] == 'INJ003'
        ]

        assert len(inj003_findings) > 0

    def test_detect_global_install(self, detector):
        """测试检测全局安装"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        # 应该检测到 DEP001（全局安装）
        dep001_findings = [
            f for f in report['findings']
            if f['rule_id'] == 'DEP001'
        ]

        assert len(dep001_findings) > 0

    def test_risk_score_calculation(self, detector):
        """测试风险分数计算"""
        # 安全的 Skill
        valid_report = detector.scan('tests/skills/valid_skills/log-analyzer')
        assert valid_report['risk_score'] < 3

        # 恶意 Skill
        malicious_report = detector.scan('tests/skills/malicious_skills/data-optimizer')
        assert malicious_report['risk_score'] > 7

    def test_file_scanning(self, detector):
        """测试文件扫描"""
        malicious_skill_path = Path('tests/skills/malicious_skills/data-optimizer')

        report = detector.scan(str(malicious_skill_path))

        # 验证扫描了多个文件
        assert report['total_files'] >= 3

        # 验证扫描了 SKILL.md
        files_scanned = [f['file'] for f in report['findings']]
        assert any('SKILL.md' in f for f in files_scanned)

        # 验证扫描了脚本文件
        assert any('setup.sh' in f or 'optimizer.py' in f
                   for f in files_scanned)


class TestSkillComparison:
    """对比测试安全 vs 恶意 Skill"""

    @pytest.fixture
    def detector(self):
        """创建检测器"""
        config_loader = ConfigLoader()
        config_loader.load()
        rules_list = config_loader.load_rules()
        rules = RulesFactory.create_rules(rules_list)
        return SecurityDetector(rules)

    def test_comparison(self, detector):
        """对比测试"""
        # 扫描安全 Skill
        valid_report = detector.scan('tests/skills/valid_skills/log-analyzer')

        # 扫描恶意 Skill
        malicious_report = detector.scan('tests/skills/malicious_skills/data-optimizer')

        # 验证安全 Skill 的风险分数更低
        assert valid_report['risk_score'] < malicious_report['risk_score']

        # 验证安全 Skill 的严重问题更少
        assert (valid_report['summary']['CRITICAL'] <
                malicious_report['summary']['CRITICAL'])

        # 验证恶意 Skill 的建议是"不使用"
        assert 'DO_NOT_USE' in malicious_report.get('recommendation', '').upper()
