from pathlib import Path
from flask import send_from_directory, abort


CONFIG_DIR = Path.home() / ".config" / "aurora-store"

def getTema():
    if not (CONFIG_DIR / "colors.css").is_file():
        abort(404)
    return send_from_directory(CONFIG_DIR, "colors.css", mimetype="text/css", max_age=0)