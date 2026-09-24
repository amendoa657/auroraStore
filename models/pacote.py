class Pacote:
    def __init__(self, dict, tipo, pkgBuild=None):
        if tipo =="aur":
            self.nome = dict["Name"]
            self.repositorio = tipo
            self.numeroVotos = dict["NumVotes"]
            self.descricao = dict["Description"]
            self.popularidade = dict["Popularity"]
            self.url = dict["URL"]
            self.versao = dict["Version"]
            self.criadores = dict["Maintainer"]
            self.tamanho = None
            self.licensas = dict.get("License")
            self.dependencias = dict.get("Depends")
            self.pkgBuild = pkgBuild

        elif tipo =="pacman":
            self.nome = dict["pkgname"]
            self.repositorio = tipo
            self.repo = dict["repo"]
            self.numeroVotos = None
            self.descricao = dict["pkgdesc"]
            self.popularidade = None
            self.url = dict["url"]
            self.versao = dict["pkgver"]
            self.criadores = dict["maintainers"]
            self.tamanho = dict["installed_size"]
            self.licensas = dict["licenses"]
            self.dependencias = dict["depends"]
            self.pkgBuild = None