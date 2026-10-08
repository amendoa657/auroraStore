SELECT *
FROM pacotes
WHERE
    nome LIKE '%firefox%'
    OR descricao LIKE '%firefox%'
ORDER BY
    CASE
        WHEN nome = 'firefox' THEN 1
        WHEN nome LIKE 'firefox%' THEN 2
        WHEN nome LIKE '%firefox%' THEN 3
        WHEN descricao LIKE '%firefox%' THEN 4
        ELSE 5
    END,
    popularidade DESC
limit 300;


SELECT COUNT(*) FROM pacotes;

CREATE VIRTUAL TABLE pacotes_fts USING fts5(
    nome,
    descricao,
    content='pacotes',
    content_rowid='rowid'
);


drop table if exists pacotes_fts;

INSERT INTO pacotes_fts(pacotes_fts)
VALUES('rebuild');

INSERT INTO pacotes_fts (nome, descricao)
SELECT nome, descricao
FROM pacotes;


SELECT *
FROM pacotes_fts
WHERE repositorio="core";

        SELECT p.*
        FROM pacotes_fts
        JOIN pacotes AS p
            ON p.rowid = pacotes_fts.rowid
        WHERE pacotes_fts MATCH 'nvidia' and pacotes_fts.repositorio="core"
        ORDER BY p.popularidade DESC;


select * from pacotes where repositorio="core";

