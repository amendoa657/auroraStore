from pathlib import Path

from database.connect import getConnection

from config.downloadFromMirrors import downloadAur
from config.downloadFromMirrors import downloadCore
from config.downloadFromMirrors import downloadExtra

con = getConnection()
cursor = con.cursor()

raiz = Path(__file__).resolve().parent.parent
#TIRAR O IGNORE PARA A VERSAO ATUALIZAR!!!!!!!!!!!!!
def insertPacotesAur():
    dados = downloadAur()

    for pacote in dados:
        cursor.execute('''
            INSERT OR REPLACE INTO pacotes (
                nome,
                repositorio,
                numeroVotos,
                descricao,
                popularidade,
                url,
                versao,
                criadores
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nome) DO UPDATE SET
                versao = excluded.versao
            ''', (
                pacote.get("Name"),
                "aur",
                pacote.get("NumVotes"),
                pacote.get("Description"),
                pacote.get("Popularity"),
                pacote.get("URL"),
                pacote.get("Version"),
                pacote.get("Maintainer")
            )
        )

    cursor.execute('''
                    INSERT INTO pacotes_fts(pacotes_fts)
                       VALUES ('rebuild');
                    ''')

    con.commit()
#TIRAR O IGNORE PARA A VERSAO ATUALIZAR!!!!!!!!!!!!!
def insertPacotesExtra():
    dados = downloadExtra()
    # print(dados)

    for pacote in dados:

        cursor.execute('''
                INSERT INTO pacotes (
                    nome,
                    repositorio,
                    descricao,
                    tamanho,
                    licensas,
                    url,
                    versao,
                    criadores
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nome) DO UPDATE SET
                versao = excluded.versao
                ''', (
            pacote.get("NAME")[0],
            "extra",
            pacote.get("DESC")[0],
            pacote.get("ISIZE")[0],
            pacote.get("LICENSE")[0],
            pacote.get("URL")[0],
            pacote.get("VERSION")[0],
            pacote.get("PACKAGER")[0]
        )
                       )

    cursor.execute('''
                        INSERT INTO pacotes_fts(pacotes_fts)
                           VALUES ('rebuild');
                        ''')

    con.commit()




def insertPacotesCore():
    dados = downloadCore()
    #print(dados)
    cursor.execute("BEGIN")

    for pacote in dados:

        cursor.execute('''
            INSERT OR REPLACE INTO pacotes (
                nome,
                repositorio,
                descricao,
                tamanho,
                licensas,
                url,
                versao,
                criadores
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(nome) DO UPDATE SET
                versao = excluded.versao
            ''', (
                pacote.get("NAME")[0],
                "core",
                pacote.get("DESC")[0],
                pacote.get("ISIZE")[0],
                pacote.get("LICENSE")[0],
                pacote.get("URL")[0],
                pacote.get("VERSION")[0],
                pacote.get("PACKAGER")[0]
            )
        )

    cursor.execute('''
                    INSERT INTO pacotes_fts(pacotes_fts)
                       VALUES ('rebuild');
                    ''')

    con.commit()


def insertPacotesMultilib():
    pass



