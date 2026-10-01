from pathlib import Path
import requests

from database.createDatabase import createDatabase

url = "https://aur.archlinux.org/packages-meta-v1.json.gz"
raiz = Path(__file__).resolve().parent.parent
pasta = raiz / "database"

def reloadDatabase():
    pasta.mkdir(exist_ok=True)

    arquivo = pasta / "packages-meta-v1.json.gz"

    r = requests.get(url)
    r.raise_for_status()

    arquivo.write_bytes(r.content)

    print("Salvo em:", arquivo)

    createDatabase()



