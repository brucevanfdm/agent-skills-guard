"""
Standalone CLI entry point for PyInstaller
Uses runpy to execute the cli module
"""
import sys
import os
import runpy

def main():
    # Fix encoding for Windows console
    if sys.platform == 'win32':
        # Set stdout and stderr to UTF-8 mode
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    # Add src directory to path
    if getattr(sys, 'frozen', False):
        # PyInstaller environment
        if hasattr(sys, '_MEIPASS'):
            src_dir = os.path.join(sys._MEIPASS, 'src')
        else:
            src_dir = os.path.join(os.path.dirname(sys.executable), 'src')
    else:
        # Development environment
        script_dir = os.path.dirname(os.path.abspath(__file__))
        src_dir = os.path.join(script_dir, 'src')

    # Add parent directory of src to sys.path so we can use 'src.cli' as module name
    parent_dir = os.path.dirname(src_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

    # Run the cli module, pass sys.argv
    # Use run_name='__main__' but control execution through sys.argv
    runpy.run_module('src.cli', run_name='__main__', alter_sys=True)

if __name__ == '__main__':
    main()
