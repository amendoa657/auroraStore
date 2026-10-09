/* Ponte entre a página e o pixels.js.

   Quem desenha o fundo de pontos e a transição entre telas é um Web Worker
   (static/js/pixels.js), fora da thread principal. Aqui só ficam as coisas
   que precisam da página: ler as cores do tema, medir as áreas, entregar os
   <canvas> e repassar mouse, tamanho e foco.

   O worker é criado no <head> da base.html, para já estar carregado quando
   este arquivo rodar. */
(function () {
  const raiz = document.documentElement;
  const canvasFundo = document.querySelector(".fundo-pontos");
  const canvasCortina = document.querySelector(".transicao-pixels");
  const trabalhador = window.__pixels;

  /* Sem worker ou sem OffscreenCanvas: fica o fundo liso, sem transição. */
  if (!canvasFundo || !trabalhador || !("transferControlToOffscreen" in canvasFundo)) {
    raiz.classList.remove("revelando");
    return;
  }

  const semMovimento =
    raiz.classList.contains("sem-animacoes") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Cores do tema ----------
     As variáveis podem vir em qualquer formato (hex, rgb, color-mix…). O
     navegador resolve num elemento de prova e um pixel de canvas devolve os
     números, que é o que o worker precisa. */
  const amostra = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function resolverCor(variavel, reserva) {
    const prova = document.createElement("i");
    prova.style.cssText = `position:absolute;visibility:hidden;color:var(${variavel}, ${reserva})`;
    document.body.appendChild(prova);
    amostra.fillStyle = getComputedStyle(prova).color;
    prova.remove();
    amostra.clearRect(0, 0, 1, 1);
    amostra.fillRect(0, 0, 1, 1);
    const [r, g, b] = amostra.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }

  const cores = [
    resolverCor("--corDestaque", "#86d7ac"),
    resolverCor("--corAcentoSecundario", "#e9b9d3"),
    resolverCor("--corAcentoTerciario", "#b5c5f9"),
  ];
  /* O tamanho da tela no máximo dobrado: acima disso o custo cresce e o
     quadradinho não fica mais nítido. */
  const escala = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Transição ----------
     A página nasceu com a cortina sólida do CSS (classe `revelando`). O
     worker desenha a mesma cobertura em pixels, avisa, a cor sólida sai e a
     onda começa. */
  if (canvasCortina && raiz.classList.contains("revelando")) {
    const caixa = canvasCortina.getBoundingClientRect();
    const origem = window.__origemPixels || {};
    const tela = canvasCortina.transferControlToOffscreen();
    trabalhador.postMessage(
      {
        tipo: "revelar",
        canvas: tela,
        largura: caixa.width,
        altura: caixa.height,
        escala,
        /* Clique fora da área (no menu, por exemplo) também vale: a onda
           entra pela borda mais próxima. Sem clique (teclado), sai do centro. */
        ox: typeof origem.x === "number" ? origem.x - caixa.left : caixa.width / 2,
        oy: typeof origem.y === "number" ? origem.y - caixa.top : caixa.height / 2,
        corCortina: resolverCor("--superficieBase", "#0f0d15"),
        cores,
      },
      [tela],
    );
  } else {
    raiz.classList.remove("revelando");
  }

  trabalhador.addEventListener("message", ({ data }) => {
    if (data.tipo === "coberto") {
      canvasCortina.style.background = "transparent";
      trabalhador.postMessage({ tipo: "iniciar" });
    } else if (data.tipo === "revelado") {
      raiz.classList.remove("revelando");
    }
  });

  /* ---------- Fundo ---------- */
  let caixaFundo = canvasFundo.getBoundingClientRect();
  const telaFundo = canvasFundo.transferControlToOffscreen();
  trabalhador.postMessage(
    {
      tipo: "fundo",
      canvas: telaFundo,
      largura: caixaFundo.width,
      altura: caixaFundo.height,
      escala,
      cores,
      corNeutra: resolverCor("--corTextoJanela", "#e6e0ec"),
      movimento: !semMovimento,
    },
    [telaFundo],
  );

  new ResizeObserver(() => {
    const nova = canvasFundo.getBoundingClientRect();
    if (nova.width === caixaFundo.width && nova.height === caixaFundo.height) {
      caixaFundo = nova;
      return;
    }
    caixaFundo = nova;
    trabalhador.postMessage({ tipo: "tamanho", largura: nova.width, altura: nova.height, escala });
  }).observe(canvasFundo);

  if (semMovimento) return;

  /* Janela sem foco (você foi para o terminal, para o navegador…) ou
     escondida: o fundo para por completo. Volta ao receber o foco. */
  const pausar = () =>
    trabalhador.postMessage({ tipo: "pausar", valor: document.hidden || !document.hasFocus() });
  window.addEventListener("blur", pausar);
  window.addEventListener("focus", pausar);
  document.addEventListener("visibilitychange", pausar);
  pausar();

  if (ponteiroFino) {
    /* A posição da área só muda quando ela muda de tamanho (ResizeObserver
       acima), então o pointermove não precisa medir nada. */
    document.addEventListener(
      "pointermove",
      (evento) => {
        trabalhador.postMessage({
          tipo: "ponteiro",
          x: evento.clientX - caixaFundo.left,
          y: evento.clientY - caixaFundo.top,
        });
      },
      { passive: true },
    );
    raiz.addEventListener("pointerleave", () => {
      trabalhador.postMessage({ tipo: "ponteiro", x: -9999, y: -9999 });
    });
  }
})();
