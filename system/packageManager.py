from config.paru import criarConfigParu

import os, subprocess, stat

def instalarPacoteParu(pacote):
    #config_paru = criarConfigParu()
    #ambiente = os.environ.copy()
    #ambiente["PARU_CONF"] = str(config_paru)

    caminho = "/tmp/paru_gui_askpass.sh"
    with open(caminho, "w") as f:
        f.write('#!/bin/bash\n')
        f.write('/usr/lib/seahorse/ssh-askpass "Digite sua senha de root: " ')

    os.chmod(caminho, stat.S_IRWXU)
    ambiente = os.environ.copy()
    ambiente['SUDO_ASKPASS'] = caminho

    resultado = subprocess.Popen(
        ["paru", "-S", "--needed", "--noconfirm", '--sudoflags', '-A', pacote],
        env=ambiente,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    return resultado