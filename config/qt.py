import importlib
import sys

# O pywebview registra de novo a ponte JavaScript <-> Python a cada página
# carregada, e o QWebChannel avisa no terminal toda vez (a fila, que recarrega
# a cada 2 s, enche o log). O aviso é inofensivo: a ponte continua funcionando.
AVISOS_IGNORADOS = (
    "Registered new object after initialization, existing clients won't be notified!",
)

_filtro = None


def silenciarAvisosQt():
    """Esconde só os avisos de AVISOS_IGNORADOS; o resto do Qt passa igual."""
    global _filtro

    # O pywebview usa o qtpy; os outros são reserva caso ele não carregue.
    qInstallMessageHandler = None
    for modulo in ("qtpy.QtCore", "PySide6.QtCore", "PyQt6.QtCore", "PyQt5.QtCore"):
        try:
            qInstallMessageHandler = importlib.import_module(modulo).qInstallMessageHandler
            break
        except ImportError:
            continue
    if qInstallMessageHandler is None:
        return

    anterior = None

    def filtrar(tipo, contexto, mensagem):
        if any(aviso in mensagem for aviso in AVISOS_IGNORADOS):
            return
        if anterior:
            anterior(tipo, contexto, mensagem)
        else:
            sys.stderr.write(mensagem + "\n")

    # Guardado no módulo para o Python não coletar o filtro enquanto o Qt usa.
    _filtro = filtrar
    anterior = qInstallMessageHandler(filtrar)
