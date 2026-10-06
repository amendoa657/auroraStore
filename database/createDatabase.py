from database.connect import cursor
from database.connect import con

from pathlib import Path
import gzip, json

raiz = Path(__file__).resolve().parent.parent
arquivoJson = raiz / "database" / "packages-meta-v1.json.gz"
def createDatabase():
    cursor.execute("drop table if exists pacotes;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pacotes (
        nome TEXT PRIMARY KEY,
        repositorio TEXT,
        numeroVotos INTEGER,
        descricao TEXT,
        popularidade REAL,
        url TEXT,
        versao TEXT,
        criadores TEXT
        tamanho TEXT,
        licensas TEXT,
        dependencias TEXT,
        pkgBuild TEXT
    )
    """)

    with gzip.open(arquivoJson, "rt", encoding="utf-8") as f:
        dados = json.load(f)

    for pacote in dados:
        cursor.execute("""
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
            """, (
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
        drop table if exists pacotes_fts;
    ''')

    cursor.execute('''
        CREATE VIRTUAL TABLE pacotes_fts USING fts5(
            nome,
            descricao,
            content='pacotes',
            content_rowid='rowid'
        );
    ''')

    cursor.execute('''
        INSERT INTO pacotes_fts(pacotes_fts)
        VALUES('rebuild');
    ''')


    con.commit()
    con.close()

    print("Database criada.")