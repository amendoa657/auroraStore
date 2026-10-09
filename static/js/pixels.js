/* Pixels: o fundo de pontos e a transição entre telas, desenhados fora da
   thread principal.

   Este arquivo roda num Web Worker. O luzes.js entrega para cá os dois
   <canvas> (transferControlToOffscreen) e só repassa ponteiro, tamanho e
   foco. Assim, carregar uma página, montar a lista de pacotes ou responder a
   um clique nunca disputa tempo com a animação, e a animação nunca trava
   esperando a página.

   O desenho é uma grade de quadradinhos. Três campos lentos, um por cor do
   tema, passam pela grade; em cada célula vence o campo mais forte e a força
   vira o tamanho do quadradinho, como uma retícula de impressão.

   Duas economias deixam isso barato:
     - cada campo é sin(u)·cos(v) com u e v "torcidos" por outro seno que
       depende só da linha (u) ou só da coluna (v). Com a soma de arcos
       (sin(a+b) = sin a·cos b + cos a·sin b) a trigonometria é feita uma
       vez por linha e uma por coluna; por célula sobram multiplicações;
     - o tamanho é arredondado para o pixel da tela, e só as células que
       mudaram desde o quadro anterior são apagadas e redesenhadas. */

const PASSO = 15; // px entre pontos
const RAIO_LENTE = 150;
const QUADRO_CALMO_MS = 1000 / 30; // campo sozinho: 30 qps sobra
const ALPHA_COR = 0.34;
const ALPHA_NEUTRO = 0.12;

const CAMPOS = [
  { fx: 0.0062, fy: 0.0048, vx: 0.05, vy: 0.032, torcao: 1.7, fase: 0.0 },
  { fx: 0.0051, fy: 0.0069, vx: -0.041, vy: 0.046, torcao: 1.4, fase: 2.1 },
  { fx: 0.0072, fy: 0.0055, vx: 0.036, vy: -0.052, torcao: 1.9, fase: 4.4 },
];

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

/* ======================================================================
   Fundo
   ====================================================================== */
const fundo = {
  ctx: null,
  largura: 0,
  altura: 0,
  escala: 1,
  colunas: 0,
  linhas: 0,
  xs: null,
  ys: null,
  trig: null, // sin/cos fixos de x·fx e y·fy, por campo
  anterior: null, // lado (em px de tela) + cor desenhados em cada célula
  estilos: null,
  movimento: true,
  pausado: false,
  revelando: false,
  ponteiro: { x: -9999, y: -9999, alvoX: -9999, alvoY: -9999, mexeuEm: 0 },
  ultimo: 0,
  quadro: 0,
};

function prepararGrade() {
  const f = fundo;
  f.colunas = Math.ceil(f.largura / PASSO) + 1;
  f.linhas = Math.ceil(f.altura / PASSO) + 1;
  const desvio = Math.floor(PASSO / 2);

  f.xs = new Float32Array(f.colunas);
  f.ys = new Float32Array(f.linhas);
  for (let i = 0; i < f.colunas; i += 1) f.xs[i] = i * PASSO + desvio;
  for (let j = 0; j < f.linhas; j += 1) f.ys[j] = j * PASSO + desvio;

  f.trig = CAMPOS.map((c) => {
    const sx = new Float32Array(f.colunas);
    const cx = new Float32Array(f.colunas);
    const sy = new Float32Array(f.linhas);
    const cy = new Float32Array(f.linhas);
    for (let i = 0; i < f.colunas; i += 1) {
      sx[i] = Math.sin(f.xs[i] * c.fx);
      cx[i] = Math.cos(f.xs[i] * c.fx);
    }
    for (let j = 0; j < f.linhas; j += 1) {
      sy[j] = Math.sin(f.ys[j] * c.fy);
      cy[j] = Math.cos(f.ys[j] * c.fy);
    }
    return {
      sx, cx, sy, cy,
      sinL: new Float32Array(f.linhas), cosL: new Float32Array(f.linhas),
      sinC: new Float32Array(f.colunas), cosC: new Float32Array(f.colunas),
    };
  });

  /* -1 força o primeiro desenho de todas as células. */
  f.anterior = new Int16Array(f.colunas * f.linhas * 2).fill(-1);
}

function redimensionarFundo(largura, altura, escala) {
  const f = fundo;
  if (!f.ctx) return;
  f.largura = largura;
  f.altura = altura;
  f.escala = escala;
  f.ctx.canvas.width = Math.round(largura * escala);
  f.ctx.canvas.height = Math.round(altura * escala);
  f.ctx.setTransform(escala, 0, 0, escala, 0, 0);
  prepararGrade();
  desenharFundo();
}

function desenharFundo() {
  const f = fundo;
  const ctx = f.ctx;
  const t = Date.now() / 1000;
  const p = f.ponteiro;

  /* A lente segue o cursor com atraso, para não colar no mouse. */
  p.x += (p.alvoX - p.x) * 0.18;
  p.y += (p.alvoY - p.y) * 0.18;

  /* Termos que mudam com o tempo: um por linha e um por coluna. */
  for (let k = 0; k < 3; k += 1) {
    const c = CAMPOS[k];
    const g = f.trig[k];
    for (let j = 0; j < f.linhas; j += 1) {
      const b = t * c.vx + Math.sin(f.ys[j] * c.fy * 0.7 + t * 0.07 + c.fase) * c.torcao;
      g.sinL[j] = Math.sin(b);
      g.cosL[j] = Math.cos(b);
    }
    for (let i = 0; i < f.colunas; i += 1) {
      const d = t * c.vy + Math.cos(f.xs[i] * c.fx * 0.6 - t * 0.05 + c.fase) * c.torcao;
      g.sinC[i] = Math.sin(d);
      g.cosC[i] = Math.cos(d);
    }
  }

  const lenteAtiva = p.x > -999;
  const raio2 = RAIO_LENTE * RAIO_LENTE;
  const passoTela = 1 / f.escala; // arredonda o lado para o pixel físico
  const [g0, g1, g2] = f.trig;
  const anterior = f.anterior;
  let estiloAtual = -1;

  for (let j = 0; j < f.linhas; j += 1) {
    const y = f.ys[j];
    const dy = y - p.y;
    for (let i = 0; i < f.colunas; i += 1) {
      const x = f.xs[i];

      /* sin(x·fx + b)·cos(y·fy + d), por soma de arcos. */
      const v0 = (g0.sx[i] * g0.cosL[j] + g0.cx[i] * g0.sinL[j]) * (g0.cy[j] * g0.cosC[i] - g0.sy[j] * g0.sinC[i]);
      const v1 = (g1.sx[i] * g1.cosL[j] + g1.cx[i] * g1.sinL[j]) * (g1.cy[j] * g1.cosC[i] - g1.sy[j] * g1.sinC[i]);
      const v2 = (g2.sx[i] * g2.cosL[j] + g2.cx[i] * g2.sinL[j]) * (g2.cy[j] * g2.cosC[i] - g2.sy[j] * g2.sinC[i]);

      let melhor = 0;
      let forca = v0;
      if (v1 > forca) { forca = v1; melhor = 1; }
      if (v2 > forca) { forca = v2; melhor = 2; }

      let lente = 0;
      if (lenteAtiva) {
        const dx = x - p.x;
        const d2 = dx * dx + dy * dy;
        if (d2 < raio2) {
          const q = 1 - Math.sqrt(d2) / RAIO_LENTE;
          lente = q * q;
        }
      }

      const nivel = Math.max(0, (forca - 0.35) / 0.65) + lente * 0.55;
      let lado;
      let estilo;
      if (nivel <= 0.02) {
        lado = 1 + lente * 1.5;
        estilo = 3; // neutro
      } else {
        lado = Math.min(1.5 + nivel * 4, PASSO - 6);
        estilo = melhor;
      }

      /* Lado em pixels físicos, inteiro: é o que permite comparar. */
      const ladoTela = Math.round(lado / passoTela);
      const indice = (j * f.colunas + i) * 2;
      if (anterior[indice] === ladoTela && anterior[indice + 1] === estilo) continue;

      const apagar = Math.max(anterior[indice], ladoTela) * passoTela + 2;
      ctx.clearRect(x - apagar / 2, y - apagar / 2, apagar, apagar);
      anterior[indice] = ladoTela;
      anterior[indice + 1] = estilo;
      if (ladoTela === 0) continue;

      if (estilo !== estiloAtual) {
        ctx.fillStyle = f.estilos[estilo];
        estiloAtual = estilo;
      }
      const l = ladoTela * passoTela;
      ctx.fillRect(x - l / 2, y - l / 2, l, l);
    }
  }
}

function lacoFundo(agora) {
  const f = fundo;
  f.quadro = 0;
  if (f.pausado || f.revelando || !f.movimento) return;

  /* Com o mouse mexendo, a lente acompanha a taxa da tela; parado, o campo
     anda a 30 qps (ele é lento, não precisa de mais). */
  const mexendo = agora - f.ponteiro.mexeuEm < 400;
  if (mexendo || agora - f.ultimo >= QUADRO_CALMO_MS) {
    f.ultimo = agora;
    desenharFundo();
  }
  f.quadro = requestAnimationFrame(lacoFundo);
}

function acordarFundo() {
  const f = fundo;
  if (f.quadro || f.pausado || f.revelando || !f.movimento || !f.ctx) return;
  f.quadro = requestAnimationFrame(lacoFundo);
}

/* ======================================================================
   Transição: a cortina de pixels
   ====================================================================== */
const ESPALHAR_MS = 300; // tempo para a onda atravessar a área
const ENCOLHER_MS = 190; // tempo de cada célula sumir
const ESPERA_MAX_MS = 120; // se a página demorar a liberar, começa assim mesmo

const cortina = {
  ctx: null,
  celulas: null, // x, y, atraso, cor — por célula
  feitas: null,
  total: 0,
  inicio: 0,
  iniciada: false,
  corCortina: "",
  cores: null,
};

function prepararCortina(dados) {
  const c = cortina;
  const { largura, altura, escala, ox, oy } = dados;
  c.ctx = dados.canvas.getContext("2d");
  c.ctx.canvas.width = Math.round(largura * escala);
  c.ctx.canvas.height = Math.round(altura * escala);
  c.ctx.setTransform(escala, 0, 0, escala, 0, 0);
  c.corCortina = rgba(dados.corCortina, 1);
  c.cores = dados.cores.map((cor) => rgba(cor, 1));

  const colunas = Math.ceil(largura / PASSO);
  const linhas = Math.ceil(altura / PASSO);
  const alcance = Math.max(
    Math.hypot(ox, oy),
    Math.hypot(largura - ox, oy),
    Math.hypot(ox, altura - oy),
    Math.hypot(largura - ox, altura - oy),
  );
  const t = Date.now() / 1000;

  /* Atraso e cor de cada célula saem uma vez só: durante a onda, cada
     quadro é só aritmética. A cor é a do campo do fundo naquele ponto. */
  c.total = colunas * linhas;
  c.celulas = new Float32Array(c.total * 4);
  c.feitas = new Uint8Array(c.total);
  let n = 0;
  for (let j = 0; j < linhas; j += 1) {
    for (let i = 0; i < colunas; i += 1) {
      const cx = i * PASSO + PASSO / 2;
      const cy = j * PASSO + PASSO / 2;
      let melhor = 0;
      let forca = -Infinity;
      for (let k = 0; k < 3; k += 1) {
        const cc = CAMPOS[k];
        const u = cx * cc.fx + t * cc.vx + Math.sin(cy * cc.fy * 0.7 + t * 0.07 + cc.fase) * cc.torcao;
        const v = cy * cc.fy + t * cc.vy + Math.cos(cx * cc.fx * 0.6 - t * 0.05 + cc.fase) * cc.torcao;
        const valor = Math.sin(u) * Math.cos(v);
        if (valor > forca) {
          forca = valor;
          melhor = k;
        }
      }
      c.celulas[n * 4] = i * PASSO;
      c.celulas[n * 4 + 1] = j * PASSO;
      c.celulas[n * 4 + 2] = (Math.hypot(cx - ox, cy - oy) / alcance) * ESPALHAR_MS;
      c.celulas[n * 4 + 3] = melhor;
      n += 1;
    }
  }

  /* Primeiro quadro: tudo coberto. Avisa a página para tirar a cor sólida
     do CSS, que segurava a cobertura até aqui. */
  c.ctx.fillStyle = c.corCortina;
  c.ctx.fillRect(0, 0, largura, altura);
  c.iniciada = false;
  postMessage({ tipo: "coberto" });
  setTimeout(iniciarCortina, ESPERA_MAX_MS);
}

function iniciarCortina() {
  const c = cortina;
  if (c.iniciada || !c.ctx) return;
  c.iniciada = true;
  c.inicio = performance.now();
  requestAnimationFrame(quadroCortina);
}

function quadroCortina(agora) {
  const c = cortina;
  const ctx = c.ctx;
  const decorrido = agora - c.inicio;
  const cel = c.celulas;
  let restantes = 0;
  let estiloAtual = -1;

  for (let n = 0; n < c.total; n += 1) {
    if (c.feitas[n]) continue;
    const p = (decorrido - cel[n * 4 + 2]) / ENCOLHER_MS;
    if (p <= 0) {
      restantes += 1;
      continue; // ainda coberta: já está desenhada
    }

    const x = cel[n * 4];
    const y = cel[n * 4 + 1];
    ctx.clearRect(x, y, PASSO, PASSO);
    if (p >= 1) {
      c.feitas[n] = 1;
      continue;
    }

    restantes += 1;
    const saida = 1 - (1 - p) ** 3; // ease-out cúbico
    const lado = (PASSO - 2) * (1 - saida);
    const cor = cel[n * 4 + 3];
    if (cor !== estiloAtual) {
      ctx.fillStyle = c.cores[cor];
      estiloAtual = cor;
    }
    ctx.fillRect(x + (PASSO - lado) / 2, y + (PASSO - lado) / 2, lado, lado);
  }

  if (restantes > 0) {
    requestAnimationFrame(quadroCortina);
    return;
  }

  c.ctx = null;
  c.celulas = null;
  fundo.revelando = false;
  acordarFundo();
  postMessage({ tipo: "revelado" });
}

/* ======================================================================
   Mensagens da página
   ====================================================================== */
onmessage = ({ data }) => {
  switch (data.tipo) {
    case "fundo": {
      const f = fundo;
      f.ctx = data.canvas.getContext("2d");
      f.movimento = data.movimento;
      f.estilos = [
        rgba(data.cores[0], ALPHA_COR),
        rgba(data.cores[1], ALPHA_COR),
        rgba(data.cores[2], ALPHA_COR),
        rgba(data.corNeutra, ALPHA_NEUTRO),
      ];
      redimensionarFundo(data.largura, data.altura, data.escala);
      acordarFundo();
      break;
    }
    case "tamanho":
      redimensionarFundo(data.largura, data.altura, data.escala);
      break;
    case "ponteiro": {
      const p = fundo.ponteiro;
      p.alvoX = data.x;
      p.alvoY = data.y;
      if (p.x < -999 && data.x > -999) {
        p.x = data.x;
        p.y = data.y;
      }
      p.mexeuEm = performance.now();
      acordarFundo();
      break;
    }
    case "pausar":
      fundo.pausado = data.valor;
      acordarFundo();
      break;
    case "revelar":
      fundo.revelando = true;
      prepararCortina(data);
      break;
    case "iniciar":
      iniciarCortina();
      break;
  }
};
