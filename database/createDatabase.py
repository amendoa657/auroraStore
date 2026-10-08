import gzip
import json
from pathlib import Path

from database.connect import getConnection
from database.insertDatabase import insertPacotesAur
from database.insertDatabase import insertPacotesCore


con = getConnection()
cursor = con.cursor()
raiz = Path(__file__).resolve().parent.parent

def createDatabase():
    #cursor.execute("drop table if exists pacotes;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pacotes (
        nome TEXT PRIMARY KEY,
        repositorio TEXT,
        numeroVotos INTEGER,
        descricao TEXT,
        popularidade REAL,
        url TEXT,
        versao TEXT,
        criadores TEXT,
        tamanho TEXT,
        licensas TEXT,
        dependencias TEXT,
        pkgBuild TEXT,
        instalado BOOLEAN default false
    )
    """)

    #cursor.execute('''
    #    drop table if exists pacotes_fts;
    #''')

    cursor.execute('''
        CREATE VIRTUAL TABLE IF NOT EXISTS pacotes_fts USING fts5(
            nome,
            descricao,
            content='pacotes',
            content_rowid='rowid'
        );
    ''')


    con.commit()

    print("Database criada.")

    insertPacotesAur()
    print("Aur criada com sucesso.")

    insertPacotesCore()
    print("Core criada com sucesso.")


