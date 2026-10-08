import time

import requests

from database.connect import getConnection
from models.pacote import Pacote


def buscarPacotes(termo):
    con = getConnection()
    cursor = con.cursor()

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
        f"{termo}",
        f"{termo}",
        f'{termo}%',
        f'%{termo}%',
    ))

    pacotes = [Pacote.fromColuna(coluna) for coluna in cursor.fetchall()]

    con.close()
    return pacotes


def buscarPacote(nome):
    con = getConnection()
    cursor = con.cursor()

    cursor.execute('''
        SELECT p.*
        FROM pacotes AS p
        WHERE p.nome = ?
        LIMIT 1;
    ''', ('nvim-lazy',))

    pacote = Pacote.fromColuna(cursor.fetchall()[0])

    return pacote



def buscarPopulares(limite):
    con = getConnection()
    cursor = con.cursor()

    cursor.execute('''
        SELECT p.*
        FROM pacotes_fts
        JOIN pacotes AS p
            ON p.rowid = pacotes_fts.rowid
        WHERE pacotes_fts.repositorio="aur"
        ORDER BY
            p.popularidade DESC
        limit ?;
    ''',(limite,))

    pacotes = [Pacote.fromColuna(coluna) for coluna in cursor.fetchall()]
    
    con.close()
    return pacotes

def buscarVotados(limite):
    con = getConnection()
    cursor = con.cursor()

    cursor.execute('''
        SELECT p.*
        FROM pacotes_fts
        JOIN pacotes AS p
            ON p.rowid = pacotes_fts.rowid
        WHERE pacotes_fts.repositorio="aur"
        ORDER BY
            p.numeroVotos DESC
        limit ?;
    ''',(limite,))

    pacotes = [Pacote.fromColuna(coluna) for coluna in cursor.fetchall()]
    
    con.close()
    return pacotes




def buscarPopularesAntigo(limite):
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


