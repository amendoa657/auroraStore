from flask import Blueprint, current_app, render_template, request

from config.busca import busca
from config.fontes import fontes
from services.pacotesService import buscarPacote, buscarPacotes

aurBp = Blueprint("aurBp", __name__)


@aurBp.get("/buscar")
def buscarAur():
    termo = request.args.get("q", "").strip()
    modo = request.args.get("modo", "").strip()

    if "q" in request.args:
        current_app.config["ULTIMA_PESQUISA"] = termo

    termoAtual = current_app.config["ULTIMA_PESQUISA"]
    print("termo: ", current_app.config["ULTIMA_PESQUISA"])

    resultados = buscarPacotes(termoAtual, modo)

    return render_template(
        "buscar.html",
        resultados=resultados,
        contagens=None,
        termo=termoAtual,
        fontes=fontes,
        modo=modo

    )

@aurBp.get("/buscar/<pacote>")
def buscarPacoteAur(pacote):
    pacote=buscarPacote(pacote)
    modo = request.args.get("modo", "").strip()
    pagina = request.args.get("pagina", "").strip()

    return render_template(
        "pacote.html",
        pacote=pacote,
        contagens=None,
        fontes=fontes,
    )

