"""
automation/manager.py
Re-exports automation_manager singleton from the original automation_manager.py.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from automation_manager import automation_manager  # noqa: F401
