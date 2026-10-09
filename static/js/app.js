/* O pouco de JavaScript que esta loja precisa.

   Quem monta as telas é o Flask: os pacotes chegam prontos no HTML. Aqui só
   ficam as quatro coisas que o servidor não tem como fazer sozinho, porque
   acontecem depois que a página já está na tela. */

/* 1. A gaveta do menu em telas estreitas.
      Abre no botão de três riscos e fecha no fundo escuro ou no Esc. */
document.addEventListener("click", (evento) => {
  if (evento.target.closest("[data-menu]")) {
    document.body.classList.toggle("lateral-aberta");
  }
  if (evento.target.closest("[data-fechar-menu]")) {
    document.body.classList.remove("lateral-aberta");
  }

  /* 2. Diálogos. O botão diz qual abrir em data-abrir="id-do-dialogo";
        qualquer data-fechar dentro dele fecha. O resto (fundo escuro, foco,
        tecla Esc) é o próprio <dialog> que cuida. */
  const abrir = evento.target.closest("[data-abrir]");
  if (abrir) {
    document.getElementById(abrir.dataset.abrir).showModal();
  }
  const fechar = evento.target.closest("[data-fechar]");
  if (fechar) {
    fechar.closest("dialog").close();
  }
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    document.body.classList.remove("lateral-aberta");
  }

  /* 3. A tecla "/" leva direto para a busca, como em qualquer loja. */
  if (evento.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    const campo = document.querySelector(".campo-central, .campo-busca");
    if (campo) {
      evento.preventDefault();
      campo.focus();
      campo.select();
    }
  }
});

/* 4. O <select> de ordenação envia o formulário ao mudar, para não precisar de
      um botão "aplicar" do lado. Sem JavaScript, o <noscript> do template
      mostra esse botão. */
document.querySelectorAll("[data-enviar]").forEach((campo) => {
  campo.addEventListener("change", () => campo.form.submit());
});

/* 5. O X da busca. Com uma busca feita, ele é um link que limpa no servidor.
      Antes de buscar, ele só aparece enquanto há texto e limpa o campo aqui
      mesmo, sem recarregar. */
document.querySelectorAll("[data-limpar-busca]").forEach((botao) => {
  const campo = botao.closest("form").querySelector("input[type=search]");
  const buscaFeita = !botao.hidden;

  campo.addEventListener("input", () => {
    if (!buscaFeita) botao.hidden = campo.value === "";
  });

  botao.addEventListener("click", (evento) => {
    if (buscaFeita) return;
    evento.preventDefault();
    campo.value = "";
    botao.hidden = true;
    campo.focus();
  });
});

/* 6. Sincronizar mirrors. A rota /syncDb demora (baixa os bancos inteiros):
      a tecla fica afundada e os blocos girando até a resposta chegar. */
document.querySelectorAll("[data-sincronizar]").forEach((formulario) => {
  formulario.addEventListener("submit", () => {
    const botao = formulario.querySelector("button");
    botao.classList.add("sincronizando");
    botao.setAttribute("aria-busy", "true");
    formulario.querySelector("[data-rotulo-sync]").textContent = "Sincronizando";
  });
});

/* 7. Origem da transição de pixels: ao sair da página, guarda onde foi o
      último clique (se foi agora há pouco). A próxima página desfaz a
      cortina a partir desse ponto — veja o <head> da base.html e o luzes.js. */
let ultimoToque = null;
document.addEventListener(
  "pointerdown",
  (evento) => {
    ultimoToque = { x: evento.clientX, y: evento.clientY, t: Date.now() };
  },
  { capture: true, passive: true },
);
window.addEventListener("pagehide", () => {
  const recente = ultimoToque && Date.now() - ultimoToque.t < 5000;
  try {
    sessionStorage.setItem(
      "pixels:origem",
      JSON.stringify(recente ? { x: ultimoToque.x, y: ultimoToque.y, t: Date.now() } : { t: Date.now() }),
    );
  } catch (erro) {}
});

/* A saída do build começa rolada até o fim, que é onde está o que interessa. */
const terminal = document.querySelector(".terminal-saida");
if (terminal) {
  terminal.scrollTop = terminal.scrollHeight;
}
