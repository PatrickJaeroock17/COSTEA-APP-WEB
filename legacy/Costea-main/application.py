"""WSGI entry point auto-detected by Azure App Service."""

import sys
from importlib import import_module
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent / "costos_app"
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

app = import_module("app").create_app()
