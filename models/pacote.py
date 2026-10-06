from dataclasses import dataclass

@dataclass
class Pacote:
    nome: str
    repositorio: str
    numeroVotos: int
    descricao: str
    popularidade: float
    url: str
    versao: str
    criadores: str
    licensas: str
    dependencias: str
    pkgBuild: str

    @classmethod
    def fromColuna(cls, coluna):
        return cls(
            nome=coluna["nome"],
            repositorio=coluna["repositorio"],
            numeroVotos=coluna["numeroVotos"],
            descricao=coluna["descricao"],
            popularidade=coluna["popularidade"],
            url=coluna["url"],
            versao=coluna["versao"],
            criadores=coluna["criadores"],
            licensas=coluna["licensas"],
            dependencias=coluna["dependencias"],
            pkgBuild=coluna["pkgBuild"]
        )