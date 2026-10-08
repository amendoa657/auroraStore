import requests, gzip, json, tarfile

from pathlib import Path

urlAur = "https://aur.archlinux.org/packages-meta-v1.json.gz"
urlCore = "https://geo.mirror.pkgbuild.com/core/os/x86_64/core.db"
urlExtra = "https://geo.mirror.pkgbuild.com/extra/os/x86_64/extra.db"
raiz = Path(__file__).resolve().parent.parent
pasta = raiz / "database"

def downloadAur():
    pasta.mkdir(parents=True, exist_ok=True)

    arquivo = pasta / "packages-meta-v1.json.gz"

    r = requests.get(urlAur)
    r.raise_for_status()

    arquivo.write_bytes(r.content)

    print("Salvo em:", arquivo)

    with gzip.open(arquivo, "rt", encoding="utf-8") as f:
        dados = json.load(f)

    return dados

def downloadCore():
    arquivo = pasta / "core.db"

    r = requests.get(urlCore)
    r.raise_for_status()

    arquivo.write_bytes(r.content)

    print("Salvo em:", arquivo)

    #solucao vibecodada
    pacotes = []

    with tarfile.open(arquivo, "r:*") as db:
        for arquivo in db:
            if not arquivo.name.endswith("/desc"):
                continue

            conteudo = db.extractfile(arquivo).read().decode("utf-8")
            dados = {}
            campo = None

            for linha in conteudo.splitlines():
                if linha.startswith("%") and linha.endswith("%"):
                    campo = linha.strip("%")
                    dados[campo] = []
                elif linha and campo:
                    dados[campo].append(linha)

            pacotes.append(dados)

    return pacotes

