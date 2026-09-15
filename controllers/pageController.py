from flask import render_template, Blueprint

from config.fontes import fontes
from config.tema import getTema

import services.pacotesService as s
import system.downloadQueue as q

pageBp = Blueprint("pageBp", __name__)
@pageBp.get("/")
def home():
    return render_template(
        "descobrir.html",
        contagens=None,
        fontes=fontes,
        populares=s.buscarPopulares(),
        destaque=s.buscarDestaques()
    )

@pageBp.get("/configuracoes")
def getConfiguracoes():
    return render_template(
        "configuracoes.html",
        contagens=None,
        fontes=fontes
    )


@pageBp.get("/instalados")
def getInstalados():
    return render_template(
        "pacote.html",
        contagens=None,
        fontes=fontes
    )


@pageBp.get("/atualizacoes")
def getAtualizacoes():
    return render_template(
        "atualizacoes.html",
        contagens=None,
        fontes=fontes
    )

@pageBp.get("/fila")
def getFila():
    return render_template(
        "fila.html",
        contagens=None,
        fontes=fontes,
        fila=list(q.statusDownloads.values()),
        saida=q.terminal
    )


@pageBp.route("/tema.css")
def temaCss():
    return getTema()