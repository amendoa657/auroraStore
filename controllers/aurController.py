from flask import render_template, request, Blueprint, current_app
from config.fontes import fontes

from repositories.pacotesRepository import buscarPacote
from config.busca import busca

from services.pacotesService import buscarPacotes
from services.pacotesService import buscarPacote

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

