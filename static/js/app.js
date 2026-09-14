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

/* A saída do build começa rolada até o fim, que é onde está o que interessa. */
const terminal = document.querySelector(".terminal-saida");
if (terminal) {
  terminal.scrollTop = terminal.scrollHeight;
}
