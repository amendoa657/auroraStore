import subprocess
from models.pacote import Pacote
import requests

import repositories.pacotesRepository as r

destaque = "nvim-lazy"


def buscarPkgBuild(pacote):
    resposta = requests.get(
        "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=" + pacote,
        timeout=10,
        )

    return resposta.content.decode("utf-8")


def buscarPacotes(termo, modo):
    if not termo:
        return None

    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search/" + termo,
        timeout=10,
        ).json()

    resultados = resposta["results"]
    pacotes = []

    for resultado in resultados:
        pacote = Pacote(resultado, "aur")
        print(pacote.nome)
        pacotes.append(pacote)

    pacotes.sort(
        key=lambda pacote: (
            pacote.nome.casefold() != termo.casefold(),
            not pacote.nome.casefold().startswith(termo.casefold()),
            pacote.nome.casefold(),
        )
    )
    return pacotes

def buscarPacote(pacote):
    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/info/" + pacote,
        timeout=10,
    )

    dados = resposta.json()
    resultado = dados["results"]

    if resultado:
        pacote = Pacote(resultado[0], "aur", pkgBuild=buscarPkgBuild(pacote))

    return pacote



def contarLinhas(comando):
    resultado = subprocess.run(
        comando,
        capture_output=True,
        text=True,
    )

    return len(resultado.stdout.splitlines())

def buscarPacotesInstalados():
    resultado = subprocess.run(
        ["pacman", "-Qq"],
        capture_output=True,
        text=True,
        check=True,
    )

    return set(resultado.stdout.splitlines())


def buscarDestaques():
    return buscarPacote(destaque)

def buscarPopulares():
    #https://aur.archlinux.org/packages-meta-v1.json.gz fazer sistema de sqlite topzera raiz
    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search?arg=firefox&type=search",
        timeout=10,
    )

    resposta.raise_for_status()

    dados = resposta.json()

    populares = []
    for pacote in dados.get("results", []):
        populares.append(Pacote(pacote, "aur"))

    populares.sort(
        key=lambda pacote: pacote.popularidade,
        reverse=True
    )

    return populares[:7]




#instalados=buscarPacotesInstalados()
#instalados=None
#numeroInstalados=contarLinhas(["pacman", "-Qq"])
#numeroInstalados=None
#numeroAtualizacoes=contarLinhas(["pacman", "-Quq"])
#numeroAtualizacoes=None