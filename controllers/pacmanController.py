from flask import Blueprint, request, render_template

import re, subprocess
import requests

pacmanBp = Blueprint("pacmanBp", __name__)


@pacmanBp.get("/pacman/buscar")
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

@pacmanBp.post("/pacman/instalar")
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