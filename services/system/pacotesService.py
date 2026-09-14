import subprocess
from repositories.pacotesRepository import buscarPacote

destaque = "nvim-lazy"

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


def getDestaques():
    return buscarPacote(destaque)


#instalados=buscarPacotesInstalados()
#instalados=None
#numeroInstalados=contarLinhas(["pacman", "-Qq"])
#numeroInstalados=None
#numeroAtualizacoes=contarLinhas(["pacman", "-Quq"])
#numeroAtualizacoes=None