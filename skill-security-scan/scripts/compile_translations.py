#!/usr/bin/env python3
"""
编译翻译文件
"""
import os
from pathlib import Path

# 设置路径
locale_dir = Path(__file__).parent.parent / 'src' / 'i18n'

# 编译每个语言的翻译文件
for lang_dir in locale_dir.iterdir():
    if lang_dir.is_dir() and not lang_dir.name.startswith('_'):
        po_file = lang_dir / 'LC_MESSAGES' / 'skill_scan.po'
        mo_file = lang_dir / 'LC_MESSAGES' / 'skill_scan.mo'

        if po_file.exists():
            print(f"Compiling {lang_dir.name}...")
            try:
                import polib
                po = polib.pofile(str(po_file))
                po.save_as_mofile(str(mo_file))
                print(f"  ✓ Compiled: {mo_file}")
            except ImportError:
                # 如果 polib 不可用，使用 msgfmt
                import subprocess
                result = subprocess.run(
                    ['msgfmt', str(po_file), '-o', str(mo_file)],
                    capture_output=True
                )
                if result.returncode == 0:
                    print(f"  ✓ Compiled: {mo_file}")
                else:
                    print(f"  ✗ Failed: {result.stderr.decode()}")
            except Exception as e:
                print(f"  ✗ Error: {e}")
        else:
            print(f"Skipping {lang_dir.name} (no .po file)")

print("\nDone!")
