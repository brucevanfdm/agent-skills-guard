"""
配置加载器
"""
import yaml
import sys
import os
from pathlib import Path
from typing import Dict, Any, List


class ConfigLoader:
    """配置加载器"""

    def __init__(self, config_path: str = None):
        """
        初始化配置加载器

        Args:
            config_path: 配置文件路径
        """
        self.config_path = config_path
        self.config = {}

    @staticmethod
    def _get_executable_dir() -> Path:
        """
        获取可执行文件所在目录

        对于打包后的exe，返回exe所在目录或PyInstaller的临时目录
        对于开发环境，返回项目根目录

        Returns:
            Path: 可执行文件所在目录
        """
        if getattr(sys, 'frozen', False):
            # 打包后的可执行文件
            # 尝试从PyInstaller的临时目录获取资源
            # 如果资源文件在临时目录中存在，则使用临时目录
            # 否则使用可执行文件所在目录（用于用户放置的config文件夹）
            try:
                # PyInstaller创建的临时文件夹路径
                # MEIPASS是PyInstaller在运行时设置的属性
                if hasattr(sys, '_MEIPASS'):
                    # 首先检查临时目录中是否有config文件夹
                    meipass_config = Path(sys._MEIPASS) / 'config'
                    if meipass_config.exists():
                        return Path(sys._MEIPASS)

                # 如果临时目录中没有config文件夹，返回可执行文件所在目录
                # 这样用户可以将config文件夹放在exe旁边
                executable_path = Path(sys.executable).resolve()
                return executable_path.parent
            except Exception:
                # 如果出现任何错误，回退到可执行文件所在目录
                executable_path = Path(sys.executable).resolve()
                return executable_path.parent
        else:
            # 开发环境，返回当前文件所在的项目根目录
            current_file = Path(__file__).resolve()
            return current_file.parent.parent

    def load(self) -> Dict[str, Any]:
        """加载配置"""
        if self.config_path:
            self.config = self._load_yaml(self.config_path)
        else:
            # 尝试从默认位置加载
            exe_dir = self._get_executable_dir()
            default_paths = [
                # 相对于可执行文件的config目录
                exe_dir / 'config' / 'config.yaml',
                # 用户主目录
                Path.home() / '.skill-security-scan' / 'config.yaml',
                # 系统级配置目录
                Path('/etc/skill-security-scan/config.yaml'),
                # 兼容开发环境：相对于当前工作目录
                Path('config/config.yaml'),
            ]

            for path in default_paths:
                try:
                    expanded_path = path.expanduser()
                    if expanded_path.exists():
                        self.config = self._load_yaml(str(expanded_path))
                        break
                except Exception:
                    continue

        return self.config

    def load_rules(self) -> List[Dict[str, Any]]:
        """加载规则配置"""
        rules_file = self.config.get('rules', {}).get(
            'rules_file',
            'config/rules.yaml'
        )

        # 如果是相对路径，相对于可执行文件目录解析
        rules_path = Path(rules_file)
        if not rules_path.is_absolute():
            exe_dir = self._get_executable_dir()
            rules_path = exe_dir / rules_file

        rules_config = self._load_yaml(str(rules_path))

        # 转换为规则列表
        rules = []
        for category, rule_list in rules_config.items():
            rules.extend(rule_list)

        return rules

    def load_whitelist(self) -> List[str]:
        """加载白名单"""
        whitelist_file = self.config.get('rules', {}).get(
            'whitelist_file',
            'config/whitelist.yaml'
        )

        # 如果是相对路径，相对于可执行文件目录解析
        whitelist_path = Path(whitelist_file)
        if not whitelist_path.is_absolute():
            exe_dir = self._get_executable_dir()
            whitelist_path = exe_dir / whitelist_file

        try:
            whitelist_config = self._load_yaml(str(whitelist_path))
            return whitelist_config.get('whitelist', [])
        except Exception:
            return []

    def _load_yaml(self, path: str) -> Dict[str, Any]:
        """加载 YAML 文件"""
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
