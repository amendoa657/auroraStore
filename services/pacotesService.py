import subprocess

import repositories.pacotesRepository as r

destaque = "nvim-lazy"


def buscarPacotes(termo, modo):
    global pesquisa

    if not termo:
        return None

    resultados=r.buscarPacotes(termo, modo)

    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["Name"] in instalados

    return resultados

def buscarPacote(pacote):
    pkgBuild = r.buscarPkgBuild(pacote)
    pacote = r.buscarPacote(pacote)

    pacote["fonte"] = "aur"
    pacote["pkgBuild"] = pkgBuild


    #for pacote in pacotes:
    #    pacote["instalado"] = pacote["Name"] in instalados

    return pacote


def contarLinhas(comando):
    resultado = subprocess.run(
        comando,
        capture_output=True,
        text=True,
    )

    return len(resultado.stdout.splitlines())

def buscarPacotesInstalados():
    resultado = subprocess.run(
        ["pacman", "-Qq"],
        capture_output=True,
        text=True,
        check=True,
    )

    return set(resultado.stdout.splitlines())


def buscarDestaques():
    return r.buscarPacote(destaque)

def buscarPopulares():
    return r.buscarPopulares(7)


#instalados=buscarPacotesInstalados()
#instalados=None
#numeroInstalados=contarLinhas(["pacman", "-Qq"])
#numeroInstalados=None
#numeroAtualizacoes=contarLinhas(["pacman", "-Quq"])
#numeroAtualizacoes=None