from flask import render_template, request, Blueprint
from utils.fontes import fontes

import requests

from repositories.pacotesRepository import buscarPacote


aurBp = Blueprint("aurBp", __name__)


@aurBp.get("/buscar")
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

@aurBp.get("/buscar/<pacote>")
def buscarPacoteAur(pacote):
    resposta = requests.get(
        "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=" + pacote,
        timeout=10,
        )

    pkgBuild = resposta.content.decode("utf-8")

    pacote = buscarPacote(pacote)

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

@aurBp.get("/buscar/<pacote>/pkgbuild")
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