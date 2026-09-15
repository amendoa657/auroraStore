from pathlib import Path

PARU_CONFIG = """[options]

[bin]
Sudo = pkexec
"""


def criarConfigParu():
    caminho = Path.home() / ".config" / "aurora-store" / "paru.conf"

    # Cria ~/.config/aurora-store caso ainda não exista.
    caminho.parent.mkdir(parents=True, exist_ok=True)

    # Não sobrescreve a configuração se ela já existir.
    if not caminho.exists():
        caminho.write_text(PARU_CONFIG, encoding="utf-8")

    return caminho