/* Aurora: os detalhes que o CSS não faz sozinho.

   1. O campo de luzes acompanha o ponteiro com uma mola: desliza poucos
      pixels, com inércia, e o laço para assim que tudo assenta.
   2. Os cartões ganham um holofote que segue o cursor.

   As manchas em si se movem só pelo CSS (luzes.css). */
(function () {
  const raiz = document.documentElement;
  const semMovimento =
    raiz.classList.contains("sem-animacoes") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (semMovimento || !ponteiroFino) return;

  /* ---------- 1. Paralaxe com mola ---------- */
  const campo = document.querySelector(".aurora-campo");
  const ALCANCE = 26; // px que o campo anda até a borda da janela
  const RIGIDEZ = 26;
  const AMORTECIMENTO = 9;

  const estado = { x: 0, y: 0, vx: 0, vy: 0, alvoX: 0, alvoY: 0 };
  let quadro = 0;
  let ultimo = 0;

  function passo(agora) {
    /* Integração por tempo real: a mola se comporta igual a 60 ou 144 Hz. */
    const dt = Math.min((agora - ultimo) / 1000, 1 / 30);
    ultimo = agora;

    const ax = (estado.alvoX - estado.x) * RIGIDEZ - estado.vx * AMORTECIMENTO;
    const ay = (estado.alvoY - estado.y) * RIGIDEZ - estado.vy * AMORTECIMENTO;
    estado.vx += ax * dt;
    estado.vy += ay * dt;
    estado.x += estado.vx * dt;
    estado.y += estado.vy * dt;

    campo.style.transform = `translate3d(${estado.x.toFixed(2)}px, ${estado.y.toFixed(2)}px, 0)`;

    const parado =
      Math.abs(estado.alvoX - estado.x) < 0.05 &&
      Math.abs(estado.alvoY - estado.y) < 0.05 &&
      Math.abs(estado.vx) < 0.05 &&
      Math.abs(estado.vy) < 0.05;

    quadro = parado ? 0 : requestAnimationFrame(passo);
  }

  function acordar() {
    if (quadro) return;
    ultimo = performance.now();
    quadro = requestAnimationFrame(passo);
  }

  if (campo) {
    document.addEventListener(
      "pointermove",
      (evento) => {
        estado.alvoX = (0.5 - evento.clientX / window.innerWidth) * ALCANCE * 2;
        estado.alvoY = (0.5 - evento.clientY / window.innerHeight) * ALCANCE * 2;
        acordar();
      },
      { passive: true },
    );

    /* Ponteiro saiu da janela: o campo volta devagar para o centro. */
    document.documentElement.addEventListener("pointerleave", () => {
      estado.alvoX = 0;
      estado.alvoY = 0;
      acordar();
    });
  }

  /* ---------- 2. Holofote dos cartões ----------
     A posição vai em propriedades registradas com inherits: false, então
     mudar o valor não recalcula os filhos do cartão. */
  const SELETOR_HOLOFOTE = ".cartao-app, .destaque, .cartao-categoria, .item-fila";

  document.addEventListener(
    "pointermove",
    (evento) => {
      const alvo = evento.target.closest?.(SELETOR_HOLOFOTE);
      if (!alvo) return;
      /* A janela usa `zoom` (--escala-interface): a caixa vem na escala da
         tela, o gradiente desenha na escala do cartão. */
      const caixa = alvo.getBoundingClientRect();
      const escala = caixa.width / alvo.offsetWidth || 1;
      alvo.style.setProperty("--holofote-x", `${(evento.clientX - caixa.left) / escala}px`);
      alvo.style.setProperty("--holofote-y", `${(evento.clientY - caixa.top) / escala}px`);
    },
    { passive: true },
  );
})();
