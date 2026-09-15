from flask import Blueprint, request, redirect

import system.downloadQueue as q

systemBp = Blueprint("systemBp", __name__)

@systemBp.post("/aur/instalar")
def instalarAur():
    pacote = request.form.get("pacote", "")

    q.statusDownloads[pacote] = {
        "Name": pacote,
        "situacao": "aguardando",
        "progresso": 0,
        "passo": "Na fila de espera...",
    }

    q.filaDeDownloads.put(pacote)

    return redirect("/fila")