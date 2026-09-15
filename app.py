from flask import Flask
import webview

from controllers.pageController import pageBp
from controllers.aurController import aurBp
from controllers.systemController import systemBp
from controllers.pacmanController import pacmanBp

from config.paru import criarConfigParu
from system.downloadQueue import trabalhador
from system.downloadQueue import filaDeDownloads

app = Flask(__name__)
app.secret_key = "chave-secreta-paru-gui"
app.config["ULTIMA_PESQUISA"] = ""

trabalhador.start()

app.register_blueprint(pageBp)
app.register_blueprint(aurBp)
app.register_blueprint(systemBp)
app.register_blueprint(pacmanBp)



if __name__ == "__main__":
    config_paru = criarConfigParu()

    window = webview.create_window(
        "Aurora Store",
        app,
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    #app.run(debug=True)


    webview.start(debug=True)
