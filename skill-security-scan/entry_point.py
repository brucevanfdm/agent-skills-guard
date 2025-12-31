"""
Entry point for PyInstaller executable
Re-exports the CLI from src.cli without relative imports
"""
import sys
import os

# Add src to path
if getattr(sys, 'frozen', False):
    # PyInstaller environment
    if hasattr(sys, '_MEIPASS'):
        src_dir = os.path.join(sys._MEIPASS, 'src')
    else:
        src_dir = os.path.join(os.path.dirname(sys.executable), 'src')
    sys.path.insert(0, src_dir)
else:
    # Development environment
    src_dir = os.path.join(os.path.dirname(__file__), 'src')
    sys.path.insert(0, src_dir)

# Import all needed modules to prevent relative import issues
import config_loader
import rules_factory
import scanner
from reporters import ConsoleReporter, JSONReporter, HTMLReporter
import i18n
import click
from pathlib import Path
from typing import Optional
from datetime import datetime

# Now load CLI and execute
from cli import cli

if __name__ == '__main__':
    cli()
