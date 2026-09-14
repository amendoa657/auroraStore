from flask import Blueprint, request, render_template
from services.init.paru import criarConfigParu

from utils.fontes import fontes

import os, re, subprocess

systemBp = Blueprint("systemBp", __name__)

@systemBp.post("/aur/instalar")
def instalarAur():
    pacote = request.form.get("pacote", "")

    config_paru = criarConfigParu()
    ambiente = os.environ.copy()
    ambiente["PARU_CONF"] = str(config_paru)

    resultado = subprocess.run(
        ["paru", "-S", "--needed", "--noconfirm", pacote],
        env=ambiente,
    )

    if resultado.returncode == 0:
        return render_template(
            "descobrir.html",
            contagens=None,
            fontes=fontes
        )

    return f"Não foi possível instalar {pacote}.", 500