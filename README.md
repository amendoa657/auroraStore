# 📦 Paru GUI

Uma interface gráfica nativa, leve e responsiva para o **paru** (AUR Helper do Arch Linux), desenvolvida com **Flask**, **pywebview** e suporte nativo a privilégios via **Polkit**.

---

## 🎥 Demonstração

<video src="assetsReadme/showcase.mp4" controls width="100%"></video>

> *Se o seu visualizador do Git não reproduzir o player acima diretamente, você pode acessar o arquivo em [`assetsReadme/showcase.mp4`](assetsReadme/showcase.mp4).*

---

## ✨ Funcionalidades

* **Busca Inteligente:** Pesquisa rápida de pacotes no repositório oficial e no AUR, mantendo o histórico de busca ativo na sessão.
* **Terminal em Tempo Real:** Acompanhamento assíncrono da compilação e download dos pacotes com atualização contínua de status.
* **Cancelamento Gracioso:** Botão de interrupção com envio de `SIGINT` (`Ctrl+C`), permitindo que o `paru` e o `makepkg` limpem os arquivos temporários ao cancelar.
* **Gerenciamento de Elevação de Privilégios:** Utiliza `pkexec` via Polkit com suporte a cache de senha do administrador.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Backend** | Python / Flask |
| **Interface Desktop** | `pywebview` |
| **Gerenciador de Pacotes** | `paru` |
| **Autenticação** | Polkit (`pkexec`) |

---

## 📌 Pré-requisitos

Para garantir que a compilação dos pacotes do AUR ocorra sem erros, certifique-se de ter o grupo `base-devel` e as dependências básicas instaladas:

```bash
sudo pacman -S --needed base-devel python-setuptools paru