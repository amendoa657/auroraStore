import os

import requests
from flask import Flask, render_template, request
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
numeroInstalados=contarLinhas(["pacman", "-Qq"])
numeroAtualizacoes=contarLinhas(["pacman", "-Quq"])

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
        "aur.html",
        numeroAtualizacoes=numeroAtualizacoes,
        numeroInstalados=numeroInstalados
    )


@app.get("/aur/buscar")
def buscarAur():
    termo = request.args.get("q", "").strip()

    if not termo:
        return {"results": []}

    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search/" + termo,
        timeout=10,
    )

    dados = resposta.json()
    pacotes = dados["results"]

    pacotes.sort(
        key=lambda pacote: (
            pacote["Name"].casefold() != termo.casefold(),
            not pacote["Name"].casefold().startswith(termo.casefold()),
            pacote["Name"].casefold(),
        )
    )

    for pacote in pacotes:
        pacote["instalado"] = pacote["Name"] in instalados

    return render_template(
        "aur.html",
        pacotes=pacotes,
        termo=termo,
        numeroAtualizacoes=numeroAtualizacoes,
        numeroInstalados=numeroInstalados
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
            "aur.html",
            numeroAtualizacoes=numeroAtualizacoes,
            numeroInstalados=numeroInstalados
        )

    return f"Não foi possível instalar {pacote}.", 500

@app.get("/pacman")
def getPacman():
    return render_template("pacman.html")

@app.get("/pacman/buscar")
def buscarPacman():
    termo = request.args.get("q", "").strip()

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

    for pacote in pacotes:
        pacote["instalado"] = pacote["pkgname"] in instalados

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
    webview.start(debug=True)