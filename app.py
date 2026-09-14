import os

import requests
from flask import Flask, render_template, request, send_from_directory, abort
import webview

import re
import shutil
import subprocess


from pathlib import Path
app = Flask(__name__)

PARU_CONFIG = """[options]

[bin]
Sudo = pkexec
"""

def contarLinhas(comando):
    resultado = subprocess.run(
        comando,
        capture_output=True,
        text=True,
    )

    print(len(resultado.stdout.splitlines()))
    return len(resultado.stdout.splitlines())

def buscarPacotesInstalados():
    resultado = subprocess.run(
        ["pacman", "-Qq"],
        capture_output=True,
        text=True,
        check=True,
    )

    return set(resultado.stdout.splitlines())


instalados=buscarPacotesInstalados()
#instalados=None
numeroInstalados=contarLinhas(["pacman", "-Qq"])
#numeroInstalados=None
numeroAtualizacoes=contarLinhas(["pacman", "-Quq"])
#numeroAtualizacoes=None

fontes = [{"id": "aur", "rotulo": "aur", "ligada": True}]



CONFIG_DIR = Path.home() / ".config" / "aurora-store"

@app.route("/tema.css")
def tema():
    if not (CONFIG_DIR / "colors.css").is_file():
        abort(404)
    return send_from_directory(CONFIG_DIR, "colors.css", mimetype="text/css", max_age=0)

def criarConfigParu():
    caminho = Path.home() / ".config" / "aurora-store" / "paru.conf"

    # Cria ~/.config/aurora-store caso ainda não exista.
    caminho.parent.mkdir(parents=True, exist_ok=True)

    # Não sobrescreve a configuração se ela já existir.
    if not caminho.exists():
        caminho.write_text(PARU_CONFIG, encoding="utf-8")

    return caminho

@app.get("/")
def home():
    return render_template(
        "descobrir.html",
        contagens=None,
        fontes=fontes
    )

@app.get("/configuracoes")
def getConfiguracoes():
    return render_template(
        "configuracoes.html",
        contagens=None,
        fontes=fontes
    )

@app.get("/pacote/<nomePacote>")
def getPacote(nomePacote):
    return render_template(
        "pacote.html",
        contagens=None,
        fontes=fontes,
        nomePacote=nomePacote
    )

@app.get("/instalados")
def getInstalados():
    return render_template(
        "pacote.html",
        contagens=None,
        fontes=fontes
    )


@app.get("/atualizacoes")
def getAtualizacoes():
    return render_template(
        "atualizacoes.html",
        contagens=None,
        fontes=fontes
    )

@app.get("/fila")
def getFila():
    return render_template(
        "fila.html",
        contagens=None,
        fontes=fontes
    )


@app.get("/buscar")
def buscarAur():
    termo = request.args.get("q", "").strip()
    modo = request.args.get("modo", "").strip()

    if not termo:
        return render_template(
            "buscar.html",
            resultados=None,
            contagens=None,
            termo=termo,
            fontes=fontes,
            modo=modo

        )

    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search/" + termo,
        timeout=10,
    )

    dados = resposta.json()
    resultados = dados["results"]

    resultados.sort(
        key=lambda pacote: (
            pacote["Name"].casefold() != termo.casefold(),
            not pacote["Name"].casefold().startswith(termo.casefold()),
            pacote["Name"].casefold(),
        )
    )

    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["Name"] in instalados

    return render_template(
        "buscar.html",
        resultados=resultados,
        contagens=None,
        termo=termo,
        fontes=fontes,
        modo=modo

    )

@app.get("/buscar/<pacote>")
def buscarPacoteAur(pacote):


    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/info/" + pacote,
        timeout=10,
        )

    dados = resposta.json()
    resultado = dados["results"]

    resposta = requests.get(
        "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=" + pacote,
        timeout=10,
        )

    pkgBuild = resposta.content.decode("utf-8")

    if resultado:  # Verifica se a lista não está vazia
        pacote = resultado[0]
        pacote["fonte"] = "aur"


    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["Name"] in instalados

    return render_template(
        "pacote.html",
        pacote=pacote,
        contagens=None,
        fontes=fontes,
        pkgBuild=pkgBuild
    )

@app.get("/buscar/<pacote>/pkgbuild")
def buscarPkgBuild(pacote):


    pkgBuild = requests.get(
        "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=" + pacote,
        timeout=10,
        )




    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["Name"] in instalados

    return render_template(
        "pacote.html",
        pacote=pacote,
        contagens=None,
        fontes=fontes,
        pkgBuild=pkgBuild
    )


@app.post("/aur/instalar")
def instalarAur():
    pacote = request.form.get("pacote", "")

    config_paru = criarConfigParu()
    ambiente = os.environ.copy()
    ambiente["PARU_CONF"] = str(config_paru)

    resultado = subprocess.run(
        ["paru", "-S", "--needed", "--noconfirm", pacote],
        env=ambiente,
    )

    if resultado.returncode == 0:
        return render_template(
            "descobrir.html",
            contagens=None,
            fontes=fontes
        )

    return f"Não foi possível instalar {pacote}.", 500

@app.get("/pacman")
def getPacman():
    return render_template("pacman.html")

@app.get("/pacman/buscar")
def buscarPacman():
    termo = request.args.get("q", "").strip()
    page = request.args.get("page", "").strip()
    limit = 50

    if not termo:
        return {"results": []}

    dados = requests.get(
        "https://archlinux.org/packages/search/json/",
        params={"q": termo},
        timeout=10,
    ).json()

    pacotes = dados["results"]

    pacotes.sort(
        key=lambda pacote: (
            pacote["pkgname"].casefold() != termo.casefold(),
            not pacote["pkgname"].casefold().startswith(termo.casefold()),
            pacote["pkgname"].casefold(),
        )
    )

    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["pkgname"] in instalados

    return render_template(
        "pacman.html",
        pacotes=pacotes,
        termo=termo
    )

@app.post("/pacman/instalar")
def instalarPacman():
    pacote = request.form.get("pacote", "")

        # Não aceite texto arbitrário virar argumento de terminal.
    if not re.fullmatch(r"[A-Za-z0-9@._+-]+", pacote):
        return "Nome de pacote inválido.", 400


    resultado = subprocess.run(
        ["pkexec", "pacman", "-S", "--needed", "--noconfirm",pacote],
    )

    if resultado.returncode == 0:
        return render_template("pacman.html")

    return f"Não foi possível instalar {pacote}.", 500

if __name__ == "__main__":
    config_paru = criarConfigParu()

    window = webview.create_window(
        "Aurora Store",
        app,
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    #app.run(debug=True)
    webview.start(debug=True)
