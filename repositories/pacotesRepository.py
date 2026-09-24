import requests



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

