"""
命令行接口
"""
import sys
import click
from pathlib import Path
from typing import Optional
from datetime import datetime

from .config_loader import ConfigLoader
from .rules_factory import RulesFactory
from .scanner import SecurityDetector
from .reporters import ConsoleReporter, JSONReporter, HTMLReporter
from .i18n import init_i18n, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, _


@click.group(invoke_without_command=True)
@click.version_option(version='1.0.0')
@click.option('--lang', type=click.Choice(list(SUPPORTED_LANGUAGES.keys())),
              default=None, help='Language / 语言')
@click.pass_context
def cli(ctx, lang):
    """Skill-Security-Scanner - Claude Skills 安全扫描工具"""
    # 初始化国际化
    init_i18n(lang)

    # 如果没有指定子命令，默认执行 scan
    if ctx.invoked_subcommand is None:
        ctx.invoke(scan)


@cli.command()
@click.argument('paths', nargs=-1, type=click.Path(exists=True))
@click.option('-r', '--recursive', is_flag=True, help=_('Recursive scan subdirectories'))
@click.option('-o', '--output', type=click.Path(), help=_('Output report file'))
@click.option('-f', '--format', type=click.Choice(['console', 'json', 'html'], case_sensitive=False),
              default='html', help=_('Report format'))
@click.option('--rules', type=click.Path(exists=True), help=_('Custom rules file'))
@click.option('--severity', type=click.Choice(['CRITICAL', 'WARNING', 'INFO'], case_sensitive=False),
              default='INFO', help=_('Minimum display level'))
@click.option('--no-color', is_flag=True, help=_('Disable color output'))
@click.option('--fail-on', type=click.Choice(['CRITICAL', 'WARNING', 'INFO'], case_sensitive=False),
              help=_('Exit with non-zero code on specified level'))
def scan(paths: tuple, recursive: bool, output: Optional[str], format: str,
         rules: Optional[str], severity: str, no_color: bool, fail_on: Optional[str]):
    """
    Scan Skill directories

    PATHS: Skill file or directory paths (optional, scans default paths if not provided)

    Default scan paths:
      - ~/.claude/skills/ (user's Claude skills directory)
      - ./skills/ (all skills directories in current directory)
    """
    try:
        # 收集扫描路径
        scan_paths = list(paths) if paths else []

        # 如果没有指定路径，添加默认路径
        if not paths:
            import os

            # 用户主目录下的 .claude/skills/
            home_claude_skills = Path.home() / '.claude' / 'skills'
            if home_claude_skills.exists():
                scan_paths.append(str(home_claude_skills))

            # 递归查找当前目录下的所有 skill 或 skills 目录
            current_dir = Path('.')
            for root, dirs, files in os.walk('.'):
                for dir_name in dirs:
                    if dir_name in ['skill', 'skills']:
                        skill_dir = Path(root) / dir_name
                        scan_paths.append(str(skill_dir))

            # 如果没有找到任何默认路径，提示用户
            if not scan_paths:
                click.echo(_("No default skill directories found."), err=True)
                click.echo(_("Please specify a path to scan."), err=True)
                click.echo(_("Example: python -m src.cli scan /path/to/skill"), err=True)
                sys.exit(1)

        # 去重并排序
        seen = set()
        unique_paths = []
        for p in scan_paths:
            abs_path = str(Path(p).resolve())
            if abs_path not in seen:
                seen.add(abs_path)
                unique_paths.append(p)

        scan_paths = unique_paths

        # 加载配置
        config_loader = ConfigLoader()
        config_loader.load()

        # 加载规则
        if rules:
            import yaml
            with open(rules, 'r', encoding='utf-8') as f:
                rules_config = yaml.safe_load(f)
                rules_list = []
                for category, rule_list in rules_config.items():
                    rules_list.extend(rule_list)
        else:
            rules_list = config_loader.load_rules()

        # 加载白名单
        whitelist = config_loader.load_whitelist()

        # 创建规则实例
        rule_objects = RulesFactory.create_rules(rules_list)

        # 创建检测器
        detector = SecurityDetector(rule_objects, whitelist)

        # 执行扫描所有路径
        all_reports = []
        for scan_path in scan_paths:
            click.echo(_("Scanning: {path}").format(path=scan_path), err=False)
            try:
                report = detector.scan(scan_path)
                all_reports.append(report)
            except Exception as e:
                click.echo(_("Error scanning {path}: {error}").format(path=scan_path, error=e), err=True)
                continue

        # 如果没有成功扫描任何路径，退出
        if not all_reports:
            click.echo(_("Error: No valid paths were scanned"), err=True)
            sys.exit(1)

        # 合并多个报告
        if len(all_reports) == 1:
            report = all_reports[0]
        else:
            report = _merge_reports(all_reports)

        # 过滤低级别问题
        if severity != 'INFO':
            severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
            min_level = severity_order[severity]
            report['findings'] = [
                f for f in report['findings']
                if severity_order.get(f.get('severity', 'INFO'), 2) <= min_level
            ]

        # 生成报告
        # 始终生成控制台摘要用于显示扫描进度
        console_reporter = ConsoleReporter(use_color=not no_color)
        console_summary = console_reporter.generate(report)

        if format == 'json':
            reporter = JSONReporter()
            report_text = reporter.generate(report)

            # 输出报告
            if output:
                with open(output, 'w', encoding='utf-8') as f:
                    f.write(report_text)
                # 显示控制台摘要和文件保存信息
                click.echo("\n" + console_summary)
                click.echo(_("\nReport saved to: {output}").format(output=output))
            else:
                click.echo("\n" + report_text)

        elif format == 'html':
            # 获取当前语言
            from .i18n import get_language
            current_lang = get_language()
            reporter = HTMLReporter(language=current_lang)

            # 生成 HTML 报告
            report_text = reporter.generate(report)

            # 如果没有指定输出文件，使用默认文件名
            if not output:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                output = f'skill_scan_report_{timestamp}.html'

            # 保存 HTML 报告
            with open(output, 'w', encoding='utf-8') as f:
                f.write(report_text)

            # 显示控制台摘要和文件保存信息
            click.echo("\n" + console_summary)
            click.echo(_("\nReport saved to: {output}").format(output=output))

        else:  # format == 'console'
            # 仅显示控制台报告
            click.echo("\n" + console_summary)

        # 检查是否需要返回非0退出码
        if fail_on:
            severity_order = {'CRITICAL': 0, 'WARNING': 1, 'INFO': 2}
            fail_level = severity_order[fail_on]

            for finding in report.get('findings', []):
                finding_severity = finding.get('severity', 'INFO')
                if severity_order.get(finding_severity, 2) <= fail_level:
                    sys.exit(1)

    except Exception as e:
        click.echo(_("Error: {error}").format(error=e), err=True)
        sys.exit(1)


@cli.command()
@click.argument('report_file', type=click.Path(exists=True))
def report(report_file: str):
    """
    View detailed report

    REPORT_FILE: Report file path
    """
    try:
        with open(report_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # 判断报告格式
        if report_file.endswith('.json'):
            click.echo(content)
        else:
            click.echo(content)

    except Exception as e:
        click.echo(_("Error: {error}").format(error=e), err=True)
        sys.exit(1)


@cli.command()
@click.argument('action', type=click.Choice(['add', 'remove', 'list']))
@click.argument('rule_id', required=False)
def whitelist(action: str, rule_id: Optional[str]):
    """
    Manage whitelist

    ACTION: Action (add/remove/list)
    RULE_ID: Rule ID (required for add/remove)
    """
    try:
        import yaml
        from pathlib import Path

        whitelist_file = Path('config/whitelist.yaml')

        # 加载白名单
        if whitelist_file.exists():
            with open(whitelist_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                current_whitelist = set(config.get('whitelist', []))
        else:
            current_whitelist = set()

        if action == 'list':
            if current_whitelist:
                click.echo(_("Current whitelist:"))
                for rule in sorted(current_whitelist):
                    click.echo(f"  - {rule}")
            else:
                click.echo(_("Whitelist is empty"))

        elif action == 'add':
            if not rule_id:
                click.echo(_("Error: rule_id is required for add action"), err=True)
                sys.exit(1)

            current_whitelist.add(rule_id)
            _save_whitelist(whitelist_file, current_whitelist)
            click.echo(_("Added {rule_id} to whitelist").format(rule_id=rule_id))

        elif action == 'remove':
            if not rule_id:
                click.echo(_("Error: rule_id is required for remove action"), err=True)
                sys.exit(1)

            current_whitelist.discard(rule_id)
            _save_whitelist(whitelist_file, current_whitelist)
            click.echo(_("Removed {rule_id} from whitelist").format(rule_id=rule_id))

    except Exception as e:
        click.echo(_("Error: {error}").format(error=e), err=True)
        sys.exit(1)


def _merge_reports(reports: list) -> dict:
    """
    合并多个扫描报告

    Args:
        reports: 报告列表

    Returns:
        dict: 合并后的报告
    """
    merged = {
        'findings': [],
        'summary': {
            'CRITICAL': 0,
            'WARNING': 0,
            'INFO': 0
        },
        'risk_score': 0.0,
        'risk_level': 'SAFE',
        'total_issues': 0,
        'total_files': 0,
        'scanned_paths': []
    }

    # 合并所有发现
    for report in reports:
        merged['findings'].extend(report.get('findings', []))
        merged['total_files'] += report.get('total_files', 0)

        # 记录扫描的路径
        if 'skill_path' in report:
            merged['scanned_paths'].append(report['skill_path'])

    # 重新计算统计
    for finding in merged['findings']:
        severity = finding.get('severity', 'INFO')
        if severity in merged['summary']:
            merged['summary'][severity] += 1

    # 计算风险分数（使用 analyzer 的方法）
    from .scanner.analyzer import SkillAnalyzer
    analyzer = SkillAnalyzer(rules=[], whitelist=[])
    analyzer.findings = []

    # 重新创建 Finding 对象
    from .scanner.analyzer import Finding
    for f_dict in merged['findings']:
        f = Finding(
            rule_id=f_dict['rule_id'],
            severity=f_dict['severity'],
            file=f_dict['file'],
            line=f_dict['line'],
            pattern=f_dict['pattern'],
            description=f_dict['description'],
            confidence=f_dict['confidence']
        )
        analyzer.findings.append(f)

    # 生成报告部分
    report = analyzer.generate_report()
    merged['risk_score'] = report['risk_score']
    merged['risk_level'] = report['risk_level']
    merged['total_issues'] = report['total_issues']

    # 添加扫描路径信息
    merged['scanned_paths_count'] = len(merged['scanned_paths'])

    return merged


def _save_whitelist(whitelist_file: Path, whitelist: set):
    """保存白名单到文件"""
    import yaml

    with open(whitelist_file, 'w', encoding='utf-8') as f:
        yaml.dump({'whitelist': list(whitelist)}, f,
                 default_flow_style=False, allow_unicode=True)


def main():
    """主入口"""
    cli()


if __name__ == '__main__':
    main()
