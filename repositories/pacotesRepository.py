import requests



def buscarPopulares(limite=6):
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