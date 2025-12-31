"""
国际化支持模块
"""
import os
import gettext
from pathlib import Path
from typing import Optional


# 支持的语言列表
SUPPORTED_LANGUAGES = {
    'zh_CN': '简体中文',
    'en_US': 'English'
}

# 默认语言
DEFAULT_LANGUAGE = 'zh_CN'

# 当前语言
_current_language = None
_translation = None


def get_language() -> str:
    """获取当前语言"""
    global _current_language
    if _current_language is None:
        # 尝试从环境变量获取
        _current_language = os.getenv('SKILL_SCAN_LANG', DEFAULT_LANGUAGE)
    return _current_language


def set_language(language: str) -> None:
    """
    设置语言

    Args:
        language: 语言代码 (zh_CN, en_US)
    """
    global _current_language, _translation

    if language not in SUPPORTED_LANGUAGES:
        print(f"Warning: Language '{language}' not supported, using '{DEFAULT_LANGUAGE}'")
        language = DEFAULT_LANGUAGE

    _current_language = language

    # 加载翻译
    locale_dir = Path(__file__).parent
    try:
        import os
        # 确保使用 UTF-8 编码
        if 'PYTHONIOENCODING' not in os.environ:
            os.environ['PYTHONIOENCODING'] = 'utf-8'

        _translation = gettext.translation(
            'skill_scan',
            localedir=str(locale_dir),
            languages=[language],
            fallback=True
        )
        _translation.install()
    except Exception as e:
        print(f"Warning: Failed to load translation for '{language}': {e}")
        # 使用空翻译（fallback模式）
        _translation = gettext.NullTranslations()


def get_translation():
    """获取翻译对象"""
    global _translation
    if _translation is None:
        set_language(get_language())
    return _translation


def init_i18n(language: Optional[str] = None) -> None:
    """
    初始化国际化

    Args:
        language: 语言代码，如果为 None 则使用环境变量或默认值
    """
    if language:
        set_language(language)
    else:
        set_language(get_language())


# 便捷函数
def _(message: str) -> str:
    """
    翻译函数

    Args:
        message: 待翻译的文本

    Returns:
        str: 翻译后的文本
    """
    return get_translation().gettext(message)


def ngettext(singular: str, plural: str, n: int) -> str:
    """
    复数翻译函数

    Args:
        singular: 单数形式
        plural: 复数形式
        n: 数量

    Returns:
        str: 翻译后的文本
    """
    return get_translation().ngettext(singular, plural, n)


# 自动初始化
init_i18n()
