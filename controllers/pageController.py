from flask import Flask, render_template, request, send_from_directory, abort, Blueprint
from utils.fontes import fontes

from services.init.config import getTema
from services.system.pacotesService import getDestaques

from repositories.pacotesRepository import buscarPopulares

pageBp = Blueprint("pageBp", __name__)
@pageBp.get("/")
def home():
    return render_template(
        "descobrir.html",
        contagens=None,
        fontes=fontes,
        populares=buscarPopulares(),
        destaque=getDestaques()
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
        fontes=fontes
    )

@pageBp.route("/tema.css")
def temaCss():
    return getTema()