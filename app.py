import webview
from flask import Flask

from config.paru import criarConfigParu
from config.init import init
#from config.downloadFromMirrors import downloadAur


from controllers.aurController import aurBp
from controllers.pacmanController import pacmanBp
from controllers.pageController import pageBp
from controllers.systemController import systemBp

from system.downloadQueue import filaDeDownloads, trabalhador

from database.createDatabase import insertsThread

app = Flask(__name__)
app.secret_key = "chave-secreta-paru-gui"
app.config["ULTIMA_PESQUISA"] = ""



app.register_blueprint(pageBp)
app.register_blueprint(aurBp)
app.register_blueprint(systemBp)
app.register_blueprint(pacmanBp)



if __name__ == "__main__":
    config_paru = criarConfigParu()

    init()

    trabalhador.start()
    insertsThread.start()

    window = webview.create_window(
        "Aurora Store",
        app,
        width=1200,
        height=800,
        min_size=(900, 600),
    )
    app.run(debug=True)


    #webview.start(debug=False)
