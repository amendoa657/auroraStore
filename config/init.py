from pathlib import Path

from database.createDatabase import createDatabase

raiz = Path(__file__).resolve().parent.parent
pasta = raiz / "database"

def init():
    pasta.mkdir(exist_ok=True)
    createDatabase()



