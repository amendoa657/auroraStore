import requests
from models.pacote import Pacote


def buscarPacotes(termo, modo):
    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search/" + termo,
        timeout=10,
        )

    dados = resposta.json()
    resultados = dados["results"]
    pacotes = []

    for resultado in resultados:
        pacote = Pacote(resultado["Name"], resultado["NumVotes"], resultado["Description"], resultado["Popularity"], resultado["URL"], resultado["Version"], resultado["Maintainer"], None, None, None)
        print(pacote)
        pacotes.append(pacote)

    pacotes.sort(
        key=lambda pacote: (
            pacote.nome.casefold() != termo.casefold(),
            not pacote.nome.casefold().startswith(termo.casefold()),
            pacote.nome.casefold(),
        )
    )

    resultados.sort(
        key=lambda pacote: (
            pacote["Name"].casefold() != termo.casefold(),
            not pacote["Name"].casefold().startswith(termo.casefold()),
            pacote["Name"].casefold(),
        )
    )
    return resultados

def buscarPacote(pacote):
    #https://archlinux.org/packages/extra/x86_64/firefox/json
    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/info/" + pacote,
        timeout=10,
    )

    dados = resposta.json()
    resultado = dados["results"]

    if resultado:
        pacote = resultado[0]

    return pacote


def buscarPopulares(limite):
    resposta = requests.get(
        "https://aur.archlinux.org/rpc/v5/search?arg=firefox&type=search",
        timeout=10,
    )

    resposta.raise_for_status()

    dados = resposta.json()

    populares = dados.get("results", [])

    populares.sort(
        key=lambda pacote: pacote.get("Popularity", 0),
        reverse=True
    )

    return populares[:limite]

def buscarPkgBuild(pacote):
    resposta = requests.get(
        "https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=" + pacote,
        timeout=10,
        )

    return resposta.content.decode("utf-8")
