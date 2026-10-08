from pathlib import Path

from database.connect import getConnection

from config.downloadFromMirrors import downloadAur
from config.downloadFromMirrors import downloadCore

con = getConnection()
cursor = con.cursor()

raiz = Path(__file__).resolve().parent.parent
arquivoJson = raiz / "database" / "packages-meta-v1.json.gz"

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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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

def insertPacotesExtra():
    pass


def insertPacotesCore():
    dados = downloadCore()

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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                pacote.get("NAME"),
                "core",
                pacote.get("DESC"),
                pacote.get("ISIZE"),
                pacote.get("LICENSE"),
                pacote.get("URL"),
                pacote.get("VERSION"),
                pacote.get("PACKAGER")
            )
        )

    cursor.execute('''
                    INSERT INTO pacotes_fts(pacotes_fts)
                       VALUES ('rebuild');
                    ''')

    con.commit()

    pass

def insertPacotesMultilib():
    pass



