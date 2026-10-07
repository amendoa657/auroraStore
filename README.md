<div align="center">

# Aurora Store

### Uma interface desktop para descobrir, instalar e acompanhar pacotes do Arch Linux.

<img src="assetsReadme/aurora-home.png" alt="Aurora Store — tela Descobrir" width="100%">

<p>
  <a href="#o-produto-em-uma-olhada">Produto</a> ·
  <a href="#telas">Telas</a> ·
  <a href="#rodando-localmente">Rodando localmente</a>
</p>

</div>

> A Aurora Store coloca o `paru` atrás de uma interface calma, rápida e legível — com busca, detalhes da AUR, instalação e saída do build no mesmo fluxo.

<video src="assetsReadme/showcase.mp4" controls width="100%"></video>

## O produto em uma olhada

| Descobrir | Pesquisar | Instalar com contexto |
| --- | --- | --- |
| Destaques e pacotes populares em cards compactos. | AUR e repositórios oficiais em uma busca única. | Avisos de segurança, PKGBUILD, dependências e progresso visíveis. |

### A linguagem visual

Tema escuro em tons de ameixa, verde suave para ações principais, vermelho reservado para alertas da AUR e tipografia combinando **Space Grotesk** com **JetBrains Mono**. A navegação lateral deixa as fontes e os estados do sistema sempre à mão sem competir com o conteúdo.

## Telas

<table>
  <tr>
    <td width="50%">
      <strong>Descobrir</strong><br>
      <sub>O ponto de entrada: destaque e descoberta rápida.</sub><br><br>
      <img src="assetsReadme/aurora-home.png" alt="Tela Descobrir da Aurora Store" width="100%">
    </td>
    <td width="50%">
      <strong>Buscar</strong><br>
      <sub>Resultados da AUR com versão, descrição e fonte.</sub><br><br>
      <img src="assetsReadme/aurora-search.png" alt="Tela de busca da Aurora Store" width="100%">
    </td>
  </tr>
  <tr>
    <td>
      <strong>Detalhes do pacote</strong><br>
      <sub>PKGBUILD, dependências, votos e o aviso da AUR no lugar certo.</sub><br><br>
      <img src="assetsReadme/aurora-package.png" alt="Detalhes do pacote paru na Aurora Store" width="100%">
    </td>
    <td>
      <strong>Fila de instalação</strong><br>
      <sub>Uma área dedicada para acompanhar o build e a saída do terminal.</sub><br><br>
      <img src="assetsReadme/aurora-queue.png" alt="Fila de instalação da Aurora Store" width="100%">
    </td>
  </tr>
  <tr>
    <td>
      <strong>Atualizações</strong><br>
      <sub>Estado do sistema e ação de verificação sem ruído.</sub><br><br>
      <img src="assetsReadme/aurora-updates.png" alt="Tela de atualizações da Aurora Store" width="100%">
    </td>
    <td valign="top">
      <strong>O fluxo em cinco passos</strong>
      <ol>
        <li>Descubra um pacote.</li>
        <li>Pesquise na AUR ou nos repositórios oficiais.</li>
        <li>Leia detalhes e revise o PKGBUILD.</li>
        <li>Coloque a instalação na fila.</li>
        <li>Acompanhe o build em tempo real.</li>
      </ol>
    </td>
  </tr>
</table>

## Funcionalidades

- Busca de pacotes da AUR com ordenação por correspondência e popularidade.
- Navegação entre descoberta, busca, fila e atualizações.
- Tela de detalhes com dependências, votos, mantenedor, link do projeto e PKGBUILD.
- Instalação assíncrona usando `paru`.
- Saída do build acompanhada em tempo real.
- Cancelamento gracioso com `SIGINT`, permitindo que `paru` e `makepkg` limpem o processo.
- Elevação de privilégios via `pkexec` e Polkit.
- Tema personalizável por CSS, aplicado por cima da paleta base.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Python + Flask |
| Interface desktop | pywebview |
| Pacotes | paru, AUR e repositórios oficiais |
| Dados | SQLite + busca full-text |
| Estilo | HTML, CSS, Space Grotesk e JetBrains Mono |
| Privilégios | Polkit / `pkexec` |

## Rodando localmente

Instale as ferramentas do Arch necessárias para compilar pacotes da AUR:

```bash
sudo pacman -S --needed base-devel python-setuptools paru
```

Crie o ambiente e instale as dependências:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Abra a aplicação desktop:

```bash
python app.py
```

Para testar apenas as telas no navegador durante o desenvolvimento:

```bash
flask --app app:app run
```

## Créditos

O projeto nasceu como uma interface gráfica para o `paru`, com identidade própria e foco em tornar o fluxo da AUR mais compreensível.

O README anterior está preservado em [`README.before-showcase.md`](README.before-showcase.md).
