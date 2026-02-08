# Voice Workspace API
# This file now imports from the modular app structure
# For direct uvicorn execution: uvicorn server:app --host 0.0.0.0 --port 8001

from app.main import app

# Re-export for backwards compatibility
__all__ = ["app"]
