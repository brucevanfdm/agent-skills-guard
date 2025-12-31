#!/usr/bin/env python3
"""
使用 Python 内置模块编译翻译文件
"""
import os
import struct
from pathlib import Path


def compile_po_to_mo(po_path: Path, mo_path: Path) -> None:
    """
    简单的 .po 到 .mo 编译器

    Args:
        po_path: .po 文件路径
        mo_path: .mo 文件输出路径
    """
    translations = {}

    # 读取 .po 文件
    with open(po_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    msgid = None
    msgstr = None
    in_msgstr = False

    for line in lines:
        line = line.strip()
        if line.startswith('msgid '):
            # 保存之前的翻译
            if msgid is not None and msgstr is not None:
                translations[msgid] = msgstr
            # 开始新的 msgid
            msgid = line[7:].strip('"')
            msgstr = None
            in_msgstr = False
        elif line.startswith('msgstr '):
            msgstr = line[8:].strip('"')
            in_msgstr = True
        elif in_msgstr and line.startswith('"') and line.endswith('"'):
            # 多行字符串
            if msgstr is not None:
                msgstr += line[1:-1]

    # 保存最后一个翻译
    if msgid is not None and msgstr is not None and msgid:
        translations[msgid] = msgstr

    # 创建 .mo 文件
    mo_path.parent.mkdir(parents=True, exist_ok=True)

    keys = sorted(translations.keys())
    keystart = 7 * 4  # header size
    valuestart = keystart + len(keys) * 8

    # 写入 .mo 文件
    with open(mo_path, 'wb') as f:
        # 写入头部
        f.write(struct.pack('<I', 0x950412de))  # magic number
        f.write(struct.pack('<I', 0))  # format version
        f.write(struct.pack('<I', len(keys)))  # number of strings
        f.write(struct.pack('<I', keystart))  # offset of key table
        f.write(struct.pack('<I', valuestart))  # offset of value table
        f.write(struct.pack('<I', 0))  # hash table size
        f.write(struct.pack('<I', 0))  # hash table offset

        # 写入键的位置和长度
        offset = valuestart
        for key in keys:
            key_bytes = key.encode('utf-8')
            f.write(struct.pack('<II', len(key_bytes), offset))
            offset += len(key_bytes)

        # 写入值的位置和长度
        offset = valuestart + sum(len(k.encode('utf-8')) for k in keys)
        for key in keys:
            value = translations[key].encode('utf-8')
            f.write(struct.pack('<II', len(value), offset))
            offset += len(value)

        # 写入键
        for key in keys:
            f.write(key.encode('utf-8'))

        # 写入值
        for key in keys:
            f.write(translations[key].encode('utf-8'))


def main():
    """编译所有翻译文件"""
    locale_dir = Path(__file__).parent.parent / 'src' / 'i18n'

    print("Compiling translation files...")

    for lang_dir in locale_dir.iterdir():
        if lang_dir.is_dir() and not lang_dir.name.startswith('_'):
            po_file = lang_dir / 'LC_MESSAGES' / 'skill_scan.po'
            mo_file = lang_dir / 'LC_MESSAGES' / 'skill_scan.mo'

            if po_file.exists():
                try:
                    compile_po_to_mo(po_file, mo_file)
                    print(f"  [OK] {lang_dir.name}: {mo_file}")
                except Exception as e:
                    print(f"  [ERROR] {lang_dir.name}: {e}")

    print("\nCompilation complete!")


if __name__ == '__main__':
    main()
