import requests
from database.connect import getConnection
from models.pacote import Pacote
import time

def buscarPacotes(termo):
    inicio = time.perf_counter()

    con = getConnection()
    cursor = con.cursor()
    t1 = time.perf_counter()

    cursor.execute('''
        SELECT p.*
        FROM pacotes_fts
        JOIN pacotes AS p
            ON p.rowid = pacotes_fts.rowid
        WHERE pacotes_fts MATCH ?
        ORDER BY
            CASE
                WHEN p.nome = ? THEN 1
                WHEN p.nome LIKE ? THEN 2
                WHEN p.descricao LIKE ? THEN 3
                ELSE 4
            END,
            p.popularidade DESC
    ''', (
        termo,
        termo,
        f'{termo}%',
        f'%{termo}%',
    ))
    t2 = time.perf_counter()
    colunas = cursor.fetchall()
    t3 = time.perf_counter()

    pacotes = [Pacote.fromColuna(coluna) for coluna in colunas]
    t4 = time.perf_counter()

    print(f"conexão: {(t1-inicio)*1000:.2f} ms")
    print(f"execute: {(t2-t1)*1000:.2f} ms")
    print(f"fetchall: {(t3-t2)*1000:.2f} ms")
    print(f"models: {(t4-t3)*1000:.2f} ms")
    print(f"TOTAL: {(t4-inicio)*1000:.2f} ms")

    con.close()
    return pacotes

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

