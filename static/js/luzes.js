/* Fundo de pontos: uma matriz de pixels que respira.

   Cada célula da grade é um quadradinho. Três campos lentos (um por cor do
   tema) passam por cima da grade; em cada célula vence o campo mais forte,
   e a força vira o tamanho do ponto — como uma retícula de impressão. Perto
   do cursor os pontos crescem um pouco.

   O tempo vem do relógio, então trocar de página continua o desenho de onde
   estava. Com movimento reduzido, desenha um quadro só e para. */
(function () {
  const canvas = document.querySelector(".fundo-pontos");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const raiz = document.documentElement;
  const semMovimento =
    raiz.classList.contains("sem-animacoes") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ponteiroFino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const PASSO = 15; // px entre pontos
  const QUADRO_MS = 1000 / 30; // o movimento é lento, 30 qps sobra
  const RAIO_LENTE = 150;

  /* ---------- Cores do tema ----------
     Um elemento de prova deixa o navegador resolver a variável (venha ela
     em hex, rgb ou color-mix) e devolve a cor pronta para o canvas. */
  function resolverCor(variavel, reserva) {
    const prova = document.createElement("i");
    prova.style.cssText = `position:absolute;visibility:hidden;color:var(${variavel}, ${reserva})`;
    document.body.appendChild(prova);
    const cor = getComputedStyle(prova).color;
    prova.remove();
    return cor;
  }

  /* Os três acentos do Matugen, sem ajuste nenhum. */
  const cores = [
    resolverCor("--corDestaque", "#86d7ac"),
    resolverCor("--corAcentoSecundario", "#e9b9d3"),
    resolverCor("--corAcentoTerciario", "#b5c5f9"),
  ];
  const corNeutra = resolverCor("--corTextoJanela", "#e6e0ec");

  /* ---------- Tamanho ---------- */
  let largura = 0;
  let altura = 0;
  let dpr = 1;

  function medir() {
    const caixa = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    largura = caixa.width;
    altura = caixa.height;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
  }

  /* ---------- Campos ----------
     Senos com o domínio torcido por outros senos: formas orgânicas, suaves e
     baratas de calcular. Cada cor tem frequências e direções próprias. */
  const CAMPOS = [
    { fx: 0.0062, fy: 0.0048, vx: 0.05, vy: 0.032, torcao: 1.7, fase: 0.0 },
    { fx: 0.0051, fy: 0.0069, vx: -0.041, vy: 0.046, torcao: 1.4, fase: 2.1 },
    { fx: 0.0072, fy: 0.0055, vx: 0.036, vy: -0.052, torcao: 1.9, fase: 4.4 },
  ];

  function campo(c, x, y, t) {
    const u = x * c.fx + t * c.vx + Math.sin(y * c.fy * 0.7 + t * 0.07 + c.fase) * c.torcao;
    const v = y * c.fy + t * c.vy + Math.cos(x * c.fx * 0.6 - t * 0.05 + c.fase) * c.torcao;
    return Math.sin(u) * Math.cos(v); // -1 … 1
  }

  /* ---------- Cursor ---------- */
  const ponteiro = { x: -9999, y: -9999, alvoX: -9999, alvoY: -9999 };

  /* ---------- Desenho ---------- */
  function desenhar(agora) {
    const t = Date.now() / 1000;

    /* A lente segue o cursor com atraso, para não colar no mouse. */
    ponteiro.x += (ponteiro.alvoX - ponteiro.x) * 0.18;
    ponteiro.y += (ponteiro.alvoY - ponteiro.y) * 0.18;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const caminhos = [new Path2D(), new Path2D(), new Path2D()];
    const neutro = new Path2D();
    const colunas = Math.ceil(largura / PASSO) + 1;
    const linhas = Math.ceil(altura / PASSO) + 1;
    const desvio = (PASSO / 2) | 0;

    for (let j = 0; j < linhas; j += 1) {
      const y = j * PASSO + desvio;
      for (let i = 0; i < colunas; i += 1) {
        const x = i * PASSO + desvio;

        let melhor = -1;
        let forca = 0;
        for (let k = 0; k < 3; k += 1) {
          const valor = campo(CAMPOS[k], x, y, t);
          if (valor > forca) {
            forca = valor;
            melhor = k;
          }
        }

        let lente = 0;
        if (ponteiroFino) {
          const d = Math.hypot(x - ponteiro.x, y - ponteiro.y);
          if (d < RAIO_LENTE) lente = (1 - d / RAIO_LENTE) ** 2;
        }

        /* Abaixo do limiar a célula é só um pontinho neutro. */
        const nivel = Math.max(0, (forca - 0.35) / 0.65) + lente * 0.55;
        if (nivel <= 0.02 || melhor < 0) {
          const lado = 1 + lente * 1.5;
          neutro.rect(x - lado / 2, y - lado / 2, lado, lado);
          continue;
        }

        const lado = Math.min(1.5 + nivel * 4, PASSO - 6);
        caminhos[melhor].rect(x - lado / 2, y - lado / 2, lado, lado);
      }
    }

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = corNeutra;
    ctx.fill(neutro);

    ctx.globalAlpha = 0.34;
    for (let k = 0; k < 3; k += 1) {
      ctx.fillStyle = cores[k];
      ctx.fill(caminhos[k]);
    }
    ctx.globalAlpha = 1;
  }

  let ultimo = 0;
  function laco(agora) {
    if (agora - ultimo >= QUADRO_MS) {
      ultimo = agora;
      desenhar(agora);
    }
    requestAnimationFrame(laco);
  }

  /* ---------- Transição entre páginas ----------
     A página nova nasce com a cortina cobrindo o conteúdo (classe
     `revelando`, posta no <head>). Aqui a cortina vira a mesma grade de
     pixels do fundo e se desfaz numa onda que sai de onde foi o clique: cada
     célula espera a onda chegar, acende na cor do campo daquele ponto e
     encolhe até sumir. */
  const ESPALHAR_MS = 300; // tempo para a onda atravessar a área
  const ENCOLHER_MS = 190; // tempo de cada célula sumir

  function revelar() {
    const cortina = document.querySelector(".transicao-pixels");
    if (!cortina) return;
    const pincel = cortina.getContext("2d");
    const caixa = cortina.getBoundingClientRect();
    const larguraC = caixa.width;
    const alturaC = caixa.height;
    const escalaC = window.devicePixelRatio || 1;
    cortina.width = Math.round(larguraC * escalaC);
    cortina.height = Math.round(alturaC * escalaC);

    /* Clique fora da área (no menu, por exemplo) também vale: a onda só
       entra pela borda mais próxima. Sem clique (teclado), sai do centro. */
    const origem = window.__origemPixels || {};
    const ox = typeof origem.x === "number" ? origem.x - caixa.left : larguraC / 2;
    const oy = typeof origem.y === "number" ? origem.y - caixa.top : alturaC / 2;
    const alcance = Math.max(
      Math.hypot(ox, oy),
      Math.hypot(larguraC - ox, oy),
      Math.hypot(ox, alturaC - oy),
      Math.hypot(larguraC - ox, alturaC - oy),
    );

    const corCortina = resolverCor("--superficieBase", "#0f0d15");
    const colunas = Math.ceil(larguraC / PASSO);
    const linhas = Math.ceil(alturaC / PASSO);
    const inicio = performance.now();
    const t = Date.now() / 1000;

    function quadro(agora) {
      const decorrido = agora - inicio;
      pincel.setTransform(escalaC, 0, 0, escalaC, 0, 0);
      pincel.clearRect(0, 0, larguraC, alturaC);

      const cheias = new Path2D();
      const acesas = [new Path2D(), new Path2D(), new Path2D()];
      let restantes = 0;

      for (let j = 0; j < linhas; j += 1) {
        for (let i = 0; i < colunas; i += 1) {
          const x = i * PASSO;
          const y = j * PASSO;
          const cx = x + PASSO / 2;
          const cy = y + PASSO / 2;
          const atraso = (Math.hypot(cx - ox, cy - oy) / alcance) * ESPALHAR_MS;
          const p = (decorrido - atraso) / ENCOLHER_MS;

          if (p >= 1) continue;
          restantes += 1;

          if (p <= 0) {
            /* +0.5 sobrepõe as vizinhas e esconde as frestas do antialias. */
            cheias.rect(x, y, PASSO + 0.5, PASSO + 0.5);
            continue;
          }

          let melhor = 0;
          let forca = -Infinity;
          for (let k = 0; k < 3; k += 1) {
            const valor = campo(CAMPOS[k], cx, cy, t);
            if (valor > forca) {
              forca = valor;
              melhor = k;
            }
          }
          const saida = 1 - (1 - p) ** 3; // ease-out cúbico
          const lado = (PASSO - 2) * (1 - saida);
          acesas[melhor].rect(cx - lado / 2, cy - lado / 2, lado, lado);
        }
      }

      pincel.fillStyle = corCortina;
      pincel.fill(cheias);
      for (let k = 0; k < 3; k += 1) {
        pincel.fillStyle = cores[k];
        pincel.fill(acesas[k]);
      }

      /* A cor sólida do CSS só segurava o primeiro quadro. */
      cortina.style.background = "transparent";

      if (restantes > 0) {
        requestAnimationFrame(quadro);
      } else {
        raiz.classList.remove("revelando");
        cortina.style.background = "";
      }
    }

    quadro(inicio);
  }

  if (raiz.classList.contains("revelando")) revelar();

  medir();
  desenhar(performance.now());

  new ResizeObserver(() => {
    medir();
    desenhar(performance.now());
  }).observe(canvas);

  if (semMovimento) return;

  requestAnimationFrame(laco);

  if (ponteiroFino) {
    document.addEventListener(
      "pointermove",
      (evento) => {
        const caixa = canvas.getBoundingClientRect();
        ponteiro.alvoX = evento.clientX - caixa.left;
        ponteiro.alvoY = evento.clientY - caixa.top;
        if (ponteiro.x < -999) {
          ponteiro.x = ponteiro.alvoX;
          ponteiro.y = ponteiro.alvoY;
        }
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", () => {
      ponteiro.alvoX = -9999;
      ponteiro.alvoY = -9999;
    });
  }
})();
