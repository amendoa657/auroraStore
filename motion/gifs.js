// GIFs do README: laços curtos na linguagem do app (a tecla, o campo de
// pixels, a marca de quatro blocos e a onda de pixels entre telas).
//
// Mesmo contrato do filme: `desenhar(c, t)` pinta o quadro t do zero, sem
// estado entre quadros, e o acaso vem do mulberry32. Cada GIF é um laço: o
// quadro em t = duracao é idêntico ao de t = 0 (o render confere), então o
// GIF emenda sem salto. Por isso o campo de pixels anda num círculo.
import { tomDe } from "./cues.js";
import {
  CAMPOS, MONO, PALETAS, acaso, aperto, cair, caixa, carregarFontes, circulo, coresMarca,
  corTom, cortar, cursor, fonte, forcaLente, iconeApp, ladoDoCampo, lerp, limitar, marca, meio,
  misturar, rgba, saida, selo, tecla, texto, trecho,
} from "./base.js";

export const FPS = 25;
const TAU = Math.PI * 2;
const PAL = PALETAS.menta;

export async function preparar() {
  await carregarFontes();
}

/* =====================================================================
   O campo em laço e a onda de pixels
   ===================================================================== */
// A conta do campo do app, com o tempo andando num círculo (ângulo `ang`):
// o padrão gira em volta de si e volta exatamente ao começo.
const ESCALA_CAMPO = 2.4;
function campoLaco(cf, x, y, ang) {
  const u = x * cf.fx + 0.9 * Math.cos(ang + cf.fase) + Math.sin(y * cf.fy * 0.7 + 0.5 * Math.sin(ang) + cf.fase) * cf.torcao;
  const v = y * cf.fy + 0.9 * Math.sin(ang + cf.fase) + Math.cos(x * cf.fx * 0.6 - 0.5 * Math.cos(ang) + cf.fase) * cf.torcao;
  return Math.sin(u) * Math.cos(v);
}
function corLaco(x, y, ang) {
  let k = 0;
  let f = -Infinity;
  for (let i = 0; i < 3; i += 1) {
    const v = campoLaco(CAMPOS[i], x * ESCALA_CAMPO, y * ESCALA_CAMPO, ang);
    if (v > f) {
      f = v;
      k = i;
    }
  }
  return [k, f];
}

// Quadradinhos em pixel inteiro: nada de borda borrada, e o que não muda
// de um quadro para o outro fica transparente no GIF.
function fundoCampo(c, ang, x0, y0, w, h, pal, { passo = 18, alpha = 0.36, lente = null, fundo = pal.view } = {}) {
  c.fillStyle = fundo;
  c.fillRect(x0, y0, w, h);
  const s = passo / 15;
  const cores = [pal.primary, pal.secondary, pal.tertiary];
  const caminhos = [new Path2D(), new Path2D(), new Path2D()];
  const neutro = new Path2D();
  for (let y = y0 + passo / 2; y < y0 + h; y += passo) {
    for (let x = x0 + passo / 2; x < x0 + w; x += passo) {
      const [k, f] = corLaco(x, y, ang);
      const { lado, neutro: n } = ladoDoCampo(f, forcaLente(x, y, lente), s);
      const l = Math.max(1, Math.round(lado));
      (n ? neutro : caminhos[k]).rect(Math.round(x - l / 2), Math.round(y - l / 2), l, l);
    }
  }
  c.save();
  c.beginPath();
  c.rect(x0, y0, w, h);
  c.clip();
  c.fillStyle = rgba(pal.text, 0.12);
  c.fill(neutro);
  for (let k = 0; k < 3; k += 1) {
    c.fillStyle = rgba(cores[k], alpha);
    c.fill(caminhos[k]);
  }
  c.restore();
}

// A troca de tela do app: quadradinhos nas cores do campo nascem a partir
// de (ox, oy), fecham uma parede e encolhem mostrando a tela nova.
const CRESCE = 0.14;
const duracaoOnda = (espalhar) => 2 * (espalhar + 0.04 + CRESCE) + 0.06;
function onda(c, t, t0, { x0 = 0, y0 = 0, w, h, raio = 0, ox, oy, passo = 27, espalhar = 0.32, ang, pal, velho, novo }) {
  const t1 = t0 + espalhar + 0.04 + CRESCE + 0.06;
  const revelando = t >= t1;
  (revelando ? novo : velho)(c);
  if (t < t0 || t >= t0 + duracaoOnda(espalhar)) return;
  const alcance = Math.max(Math.hypot(ox - x0, oy - y0), Math.hypot(x0 + w - ox, oy - y0), Math.hypot(ox - x0, y0 + h - oy), Math.hypot(x0 + w - ox, y0 + h - oy));
  const quads = [new Path2D(), new Path2D(), new Path2D()];
  for (let j = 0; j < Math.ceil(h / passo); j += 1) {
    for (let i = 0; i < Math.ceil(w / passo); i += 1) {
      const cx = x0 + i * passo + passo / 2;
      const cy = y0 + j * passo + passo / 2;
      const atraso = (Math.hypot(cx - ox, cy - oy) / alcance) * espalhar + acaso(i, j, 23) * 0.04;
      const p = revelando ? 1 - saida(limitar((t - t1 - atraso) / CRESCE)) : saida(limitar((t - t0 - atraso) / CRESCE));
      if (p <= 0) continue;
      const l = Math.round(passo * p);
      const [k] = corLaco(cx, cy, ang);
      quads[k].rect(Math.round(cx - l / 2), Math.round(cy - l / 2), l, l);
    }
  }
  c.save();
  c.beginPath();
  c.roundRect(x0, y0, w, h, raio);
  c.clip();
  [pal.primary, pal.secondary, pal.tertiary].forEach((cor, k) => {
    c.fillStyle = cor;
    c.fill(quads[k]);
  });
  c.restore();
}

/* =====================================================================
   Peças pequenas
   ===================================================================== */
function seloG(c, x, y, rotulo, pal, oficial, k) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const w = selo(c, 0, 0, rotulo, pal, oficial);
  c.restore();
  return w * k;
}
function larguraSelo(c, rotulo, k) {
  fonte(c, 500, 10.5, MONO);
  return (c.measureText(rotulo).width + 14) * k;
}
// Ícone que entra como carimbo: um pouco maior e assenta.
function iconeCarimbo(c, t, t0, x, y, tam, nome, pal, raio) {
  const k = 1 + 0.35 * (1 - saida(trecho(t, t0, t0 + 0.14)));
  c.save();
  c.translate(x + tam / 2, y + tam / 2);
  c.scale(k, k);
  iconeApp(c, -tam / 2, -tam / 2, tam, nome, pal, raio);
  c.restore();
}
function poligono(c, cor, pts) {
  c.fillStyle = cor;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}
function bezier(p, a, b, d, e) {
  const u = 1 - p;
  return {
    x: u * u * u * a.x + 3 * u * u * p * b.x + 3 * u * p * p * d.x + p * p * p * e.x,
    y: u * u * u * a.y + 3 * u * u * p * b.y + 3 * u * p * p * d.y + p * p * p * e.y,
  };
}

/* =====================================================================
   1. A marca (cabeçalho): os quatro blocos trocam de lugar em sentido
      horário, uma casa por segundo; em quatro passos voltam ao começo.
   ===================================================================== */
const MARCA_GIF = { lado: 160, tam: 148, passos: [0.5, 1.5, 2.5, 3.5], dur: 0.42 };
function desenharMarca(c, t) {
  const { lado, tam } = MARCA_GIF;
  c.clearRect(0, 0, lado, lado);
  const b = Math.round(tam * 0.44);
  const o = (lado - tam) / 2;
  // Casas em sentido horário: em cima à esquerda, em cima à direita,
  // embaixo à direita, embaixo à esquerda.
  const casas = [[o, o], [o + tam - b, o], [o + tam - b, o + tam - b], [o, o + tam - b]];
  const cores = [PAL.primary, PAL.secondary, PAL.light, PAL.tertiary];
  let n = 0;
  let p = 0;
  for (const s of MARCA_GIF.passos) {
    if (t >= s + MARCA_GIF.dur) n += 1;
    else if (t > s) p = meio((t - s) / MARCA_GIF.dur);
  }
  // No meio do passo os blocos encolhem e não se encostam.
  const encolhe = 1 - 0.3 * Math.sin(Math.PI * p);
  cores.forEach((cor, j) => {
    const de = casas[(j + n) % 4];
    const para = casas[(j + n + 1) % 4];
    const l = Math.round(b * encolhe);
    const x = Math.round(lerp(de[0], para[0], p) + (b - l) / 2);
    const y = Math.round(lerp(de[1], para[1], p) + (b - l) / 2);
    caixa(c, x, y, l, l, Math.max(2, l * 0.07), cor);
  });
}

/* =====================================================================
   2. Descobrir: os cartões caem como teclas, o cursor passa com a lente,
      clica em Instalar e a onda de pixels limpa a tela.
   ===================================================================== */
const DESC = {
  w: 540, h: 405, duracao: 4.2,
  nomes: ["aur-sync-vote", "paru", "yay", "faugus-launcher"],
  versoes: ["0.3.0-1", "2.1.0-2", "13.0.1-1", "2.4.4-1"],
  entra: [0.15, 0.4, 0.65, 0.9],
  m: 22, gap: 16, cw: 240, ch: 172,
  alvo: 1, hover: 1.78, clique: 2.1, troca: 2.7,
};
const posDesc = (i) => ({ x: DESC.m + (i % 2) * (DESC.cw + DESC.gap), y: DESC.m + Math.floor(i / 2) * (DESC.ch + DESC.gap) });
const teclaDesc = (x, y) => ({ x: x + DESC.cw - 106, y: y + DESC.ch - 52, w: 88, h: 34 });

function cursorDesc(t) {
  const { x, y } = posDesc(DESC.alvo);
  const k = teclaDesc(x, y);
  const alvo = { x: k.x + 46, y: k.y + 16 };
  const p = meio(trecho(t, 1.15, 1.85));
  return bezier(p, { x: 600, y: 450 }, { x: 560, y: 300 }, { x: alvo.x + 70, y: alvo.y + 130 }, alvo);
}

function cartaoDesc(c, t, i) {
  const nome = DESC.nomes[i];
  const t0 = DESC.entra[i];
  const e = cair(t, t0, 40, 6);
  if (!e) return;
  const hover = i === DESC.alvo && t >= DESC.hover;
  const naFila = i === DESC.alvo && t >= DESC.clique + 0.06;
  const { x, y: y0 } = posDesc(i);
  const y = y0 + e.dy - (hover ? 4 : 0);
  const cor = corTom(PAL, tomDe(nome));
  if (e.borda || hover) caixa(c, x, y0 + (hover ? 2 : 0), DESC.cw, DESC.ch, 14, "#08070b");
  caixa(c, x, y, DESC.cw, DESC.ch, 14, hover ? PAL.cardHover : PAL.card);
  c.strokeStyle = hover ? rgba(cor, 0.7) : rgba(PAL.text, 0.09);
  c.lineWidth = hover ? 2 : 1;
  c.beginPath();
  c.roundRect(x + 0.5, y + 0.5, DESC.cw - 1, DESC.ch - 1, 14);
  c.stroke();
  iconeCarimbo(c, t, t0, x + 20, y + 20, 60, nome, PAL, 14);
  seloG(c, x + 96, y + 24, "AUR", PAL, false, 1.35);
  texto(c, nome, x + 20, y + 110, { peso: 700, tam: 23, cor: hover ? cor : PAL.text });
  texto(c, DESC.versoes[i], x + 20, y + 136, { tam: 15, fam: MONO, cor: rgba(PAL.text, 0.62) });
  const k = teclaDesc(x, y);
  const aperta = i === DESC.alvo ? aperto(t, DESC.clique, 0.05) : 0;
  const yf = tecla(c, k.x, k.y, k.w, k.h, { face: naFila ? PAL.terCont : PAL.popup, raio: 9, afundar: aperta, E: 3 });
  texto(c, naFila ? "✓ na fila" : "Instalar", k.x + k.w / 2, yf + 23, { peso: 600, tam: 15, cor: naFila ? PAL.terText : PAL.text, alinhar: "center" });
}

function quadroDescobrir(c, t, ang) {
  const cur = t >= 1.15 ? cursorDesc(t) : null;
  fundoCampo(c, ang, 0, 0, DESC.w, DESC.h, PAL, { lente: cur && { x: cur.x, y: cur.y, r: 120 } });
  DESC.nomes.forEach((_, i) => cartaoDesc(c, t, i));
  if (cur) cursor(c, cur.x, cur.y, aperto(t, DESC.clique, 0.05));
}

function desenharDescobrir(c, t) {
  const ang = (TAU * t) / DESC.duracao;
  const o = cursorDesc(DESC.clique);
  onda(c, t, DESC.troca, {
    w: DESC.w, h: DESC.h, ox: o.x, oy: o.y, ang, pal: PAL,
    velho: (cc) => quadroDescobrir(cc, t, ang),
    novo: (cc) => quadroDescobrir(cc, 0, ang),
  });
}

/* =====================================================================
   3. Buscar: "/" abre a busca, "firefox" é digitado, o Enter afunda e os
      resultados caem com o contador subindo até 745.
   ===================================================================== */
const BUS = {
  w: 540, h: 405, duracao: 4.7,
  tecla: { x: 22, y: 24, l: 72 }, barra: { x: 110, y: 24, w: 408, h: 72 },
  barraEntra: 0.15, barraAfunda: 0.45, digita: 0.75, passo: 0.085, enterEntra: 1.32, enter: 1.45, troca: 3.4,
};
const LINHAS_BUSCA = [
  ["firefox", "extra"],
  ["firefox-gnome-theme", "aur"],
  ["firefox-esr", "aur"],
  ["firefox-vencord", "aur"],
  ["firefox-extension-ruffle-nightly", "aur"],
];

function quadroBuscar(c, t, ang) {
  fundoCampo(c, ang, 0, 0, BUS.w, BUS.h, PAL);
  const { tecla: tk, barra: br } = BUS;

  // A tecla: primeiro "/", depois o Enter cai no lugar dela.
  const eEnter = cair(t, BUS.enterEntra, 40, 6);
  const eBarra = cair(t, BUS.barraEntra, 40, 6);
  if (eEnter) {
    const yf = tecla(c, tk.x, tk.y + eEnter.dy, tk.l, tk.l, { face: PAL.primary, raio: 16, afundar: aperto(t, BUS.enter, 0.06), E: 6 });
    texto(c, "↵", tk.x + tk.l / 2, yf + 49, { peso: 600, tam: 36, fam: MONO, cor: PAL.onPrimary, alinhar: "center" });
  } else if (eBarra) {
    const yf = tecla(c, tk.x, tk.y + eBarra.dy, tk.l, tk.l, { face: "#2b2931", cor: "#121016", raio: 16, afundar: aperto(t, BUS.barraAfunda, 0.06), E: 6 });
    texto(c, "/", tk.x + tk.l / 2, yf + 50, { peso: 500, tam: 38, fam: MONO, cor: PAL.text, alinhar: "center" });
  }

  // A barra de busca.
  const foco = t >= BUS.barraAfunda + 0.04;
  caixa(c, br.x, br.y, br.w, br.h, br.h / 2, PAL.card);
  c.strokeStyle = foco ? PAL.primary : rgba(PAL.text, 0.14);
  c.lineWidth = foco ? 3 : 1.5;
  c.beginPath();
  c.roundRect(br.x, br.y, br.w, br.h, br.h / 2);
  c.stroke();
  c.strokeStyle = rgba(PAL.text, 0.75);
  c.lineWidth = 3;
  c.beginPath();
  c.arc(br.x + 34, br.y + 33, 10, 0, TAU);
  c.moveTo(br.x + 41, br.y + 40);
  c.lineTo(br.x + 47, br.y + 46);
  c.stroke();
  let n = 0;
  for (let k = 0; k < 7; k += 1) if (t >= BUS.digita + k * BUS.passo) n = k + 1;
  const digitado = "firefox".slice(0, n);
  if (n) texto(c, digitado, br.x + 62, br.y + 47, { tam: 30, fam: MONO, cor: PAL.text });
  else texto(c, "Buscar pacotes", br.x + 62, br.y + 46, { tam: 24, fam: MONO, cor: rgba(PAL.text, 0.45) });
  if (foco && t < BUS.enter && (n < 7 || Math.floor(t * 2.4) % 2 === 0)) {
    fonte(c, 400, 30, MONO);
    c.fillStyle = PAL.primary;
    c.fillRect(br.x + 64 + c.measureText(digitado).width, br.y + 19, 3, 34);
  }
  if (n) {
    circulo(c, br.x + br.w - 36, br.y + br.h / 2, 15, PAL.popup);
    texto(c, "✕", br.x + br.w - 36, br.y + br.h / 2 + 5, { tam: 14, cor: rgba(PAL.text, 0.78), alinhar: "center" });
  }

  // Resultados: o contador acelera até 745 e as linhas caem uma a uma.
  if (t < BUS.enter) return;
  const v = Math.floor(745 * Math.pow(trecho(t, BUS.enter, BUS.enter + 0.6), 3));
  texto(c, String(v), 24, 148, { peso: 700, tam: 32, cor: PAL.text });
  fonte(c, 700, 32);
  const xr = 24 + c.measureText("745").width + 10;
  texto(c, "resultados", xr, 148, { tam: 22, cor: rgba(PAL.text, 0.78) });
  fonte(c, 400, 22);
  texto(c, "~7 ms", xr + c.measureText("resultados").width + 14, 148, { peso: 500, tam: 19, fam: MONO, cor: PAL.primary });
  LINHAS_BUSCA.forEach(([nome, fonteRepo], i) => {
    const e = cair(t, BUS.enter + 0.08 + i * 0.07, 18, 0);
    if (!e) return;
    const y = 166 + i * 46 + e.dy;
    caixa(c, 22, y, 496, 40, 10, PAL.card);
    const oficial = fonteRepo !== "aur";
    const rotulo = oficial ? fonteRepo : "AUR";
    const ws = larguraSelo(c, rotulo, 1.25);
    seloG(c, 504 - ws, y + 8, rotulo, PAL, oficial, 1.25);
    fonte(c, 600, 19, MONO);
    const resto = cortar(c, nome.slice(7), 430 - ws - c.measureText("firefox").width);
    texto(c, "firefox", 38, y + 27, { peso: 600, tam: 19, fam: MONO, cor: PAL.primary });
    texto(c, resto, 38 + c.measureText("firefox").width, y + 27, { peso: 600, tam: 19, fam: MONO, cor: PAL.text });
  });
}

function desenharBuscar(c, t) {
  const ang = (TAU * t) / BUS.duracao;
  onda(c, t, BUS.troca, {
    w: BUS.w, h: BUS.h, ox: BUS.barra.x + BUS.barra.w - 36, oy: BUS.barra.y + BUS.barra.h / 2, ang, pal: PAL,
    velho: (cc) => quadroBuscar(cc, t, ang),
    novo: (cc) => quadroBuscar(cc, 0, ang),
  });
}

/* =====================================================================
   4. Instalar: o aviso da AUR cai, o Instalar afunda e fica apertado
      enquanto o build anda, e volta como "Instalado".
   ===================================================================== */
const INS = {
  w: 540, h: 405, duracao: 5.4,
  topo: 0.1, aviso: 0.3, entraTecla: 0.55, aperta: 1.45, progresso: [1.6, 3.4], solta: 3.5, troca: 4.1,
  tecla: { x: 24, y: 230, w: 208, h: 62 },
};
const LOG_INS = [
  "==> Criando o pacote: firefox-gnome-theme 157-1",
  "==> Verificando dependências...",
  "==> Obtendo fontes...",
  "  -> Baixando firefox-gnome-theme-157.tar.gz",
  "==> Validando sha256sums... Passou",
  "==> Extraindo fontes...",
  "==> Iniciando package()...",
  "install -Dm644 theme/gnome-theme.css",
  "install -Dm644 theme/colors/dark.css",
  "install -Dm644 userChrome.css",
  "==> Organizando a instalação...",
  "==> Criando o pacote...",
  "  -> Comprimindo pacote...",
  ":: Instalando firefox-gnome-theme...",
];

function cursorIns(t) {
  const { x, y, w, h } = INS.tecla;
  const alvo = { x: x + w / 2 + 6, y: y + h / 2 + 4 };
  if (t < 1.65) return bezier(meio(trecho(t, 0.8, 1.35)), { x: 580, y: 440 }, { x: 520, y: 330 }, { x: alvo.x + 90, y: alvo.y + 110 }, alvo);
  return bezier(meio(trecho(t, 1.65, 2.3)), alvo, { x: alvo.x + 40, y: alvo.y + 60 }, { x: 480, y: 420 }, { x: 600, y: 470 });
}

function quadroInstalar(c, t, ang) {
  const cur = t >= 0.8 && t < 2.3 ? cursorIns(t) : null;
  fundoCampo(c, ang, 0, 0, INS.w, INS.h, PAL, { lente: cur && { x: cur.x, y: cur.y, r: 110 } });

  // Identidade do pacote.
  const e1 = cair(t, INS.topo, 36, 6);
  if (e1) {
    iconeCarimbo(c, t, INS.topo, 24, 26 + e1.dy, 72, "firefox-gnome-theme", PAL, 16);
    texto(c, "firefox-gnome-theme", 112, 58 + e1.dy, { peso: 700, tam: 25, cor: PAL.text });
    const ws = seloG(c, 112, 72 + e1.dy, "AUR", PAL, false, 1.3);
    texto(c, "157-1 · FunctionalHacker", 112 + ws + 10, 90 + e1.dy, { tam: 15, fam: MONO, cor: rgba(PAL.text, 0.62) });
  }

  // O aviso da AUR.
  const e2 = cair(t, INS.aviso, 30, 5);
  if (e2) {
    const ax = 24;
    const ay = 122;
    if (e2.borda) caixa(c, ax, ay, 492, 88, 14, "#3a0306");
    const y = ay + e2.dy;
    caixa(c, ax, y, 492, 88, 14, "#4a0a10");
    c.strokeStyle = PAL.danger;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(ax + 30, y + 44, 14, 0, TAU);
    c.stroke();
    texto(c, "!", ax + 30, y + 50, { peso: 700, tam: 17, cor: PAL.danger, alinhar: "center" });
    texto(c, "Pacote da AUR — enviado por usuários", ax + 58, y + 38, { peso: 700, tam: 19, cor: PAL.danger });
    texto(c, "Revise o PKGBUILD antes de instalar.", ax + 58, y + 64, { tam: 16, cor: PAL.dangerText });
  }

  // O Instalar: afunda e fica apertado enquanto o build anda.
  const k = INS.tecla;
  const e3 = cair(t, INS.entraTecla, 36, 6);
  if (e3) {
    const pronto = t >= INS.solta;
    const instalando = t >= INS.aperta + 0.05 && !pronto;
    let afundar = 0;
    if (t >= INS.aperta && !pronto) afundar = saida(trecho(t, INS.aperta, INS.aperta + 0.05));
    else if (pronto) afundar = 1 - saida(trecho(t, INS.solta, INS.solta + 0.12));
    const face = pronto ? PAL.terCont : instalando ? PAL.popup : PAL.primary;
    const cor = pronto ? PAL.terText : instalando ? PAL.text : PAL.onPrimary;
    const rotulo = pronto ? "✓ Instalado" : instalando ? "Instalando…" : "Instalar";
    const yf = tecla(c, k.x, k.y + e3.dy, k.w, k.h, { face, raio: 14, afundar, E: 7 });
    texto(c, rotulo, k.x + k.w / 2, yf + 40, { peso: 600, tam: 25, cor, alinhar: "center" });
  }

  // Progresso com listras andando e a linha atual do build.
  if (t >= INS.progresso[0]) {
    const p = trecho(t, INS.progresso[0], INS.progresso[1]);
    const linha = LOG_INS[Math.min(LOG_INS.length - 1, Math.floor(p * LOG_INS.length))];
    fonte(c, 400, 16, MONO);
    if (linha.startsWith("==>") || linha.startsWith("::")) {
      const seta = linha.startsWith("::") ? "::" : "==>";
      texto(c, seta, 24, 330, { tam: 16, fam: MONO, cor: PAL.primary });
      texto(c, cortar(c, linha.slice(seta.length), 380), 24 + c.measureText(seta + " ").width, 330, { tam: 16, fam: MONO, cor: rgba(PAL.text, 0.85) });
    } else texto(c, cortar(c, linha.trim(), 400), 24, 330, { tam: 16, fam: MONO, cor: rgba(PAL.text, 0.6) });
    texto(c, `${Math.round(p * 100)}%`, 516, 330, { tam: 17, fam: MONO, cor: rgba(PAL.text, 0.78), alinhar: "right" });
    caixa(c, 24, 342, 492, 14, 7, PAL.popup);
    c.save();
    c.beginPath();
    c.roundRect(24, 342, Math.max(14, 492 * p), 14, 7);
    c.clip();
    c.fillStyle = p >= 1 ? PAL.tertiary : PAL.primary;
    c.fillRect(24, 342, 492, 14);
    if (p < 1) {
      c.fillStyle = rgba(PAL.onPrimary, 0.25);
      const desl = ((t * 2) % 1) * 20;
      for (let sx = 4 + desl; sx < 540; sx += 20) {
        c.beginPath();
        c.moveTo(sx, 356);
        c.lineTo(sx + 9, 342);
        c.lineTo(sx + 18, 342);
        c.lineTo(sx + 9, 356);
        c.fill();
      }
    }
    c.restore();
  }

  if (cur) cursor(c, cur.x, cur.y, aperto(t, INS.aperta, 0.06));
}

function desenharInstalar(c, t) {
  const ang = (TAU * t) / INS.duracao;
  const k = INS.tecla;
  onda(c, t, INS.troca, {
    w: INS.w, h: INS.h, ox: k.x + k.w / 2, oy: k.y + k.h / 2, ang, pal: PAL,
    velho: (cc) => quadroInstalar(cc, t, ang),
    novo: (cc) => quadroInstalar(cc, 0, ang),
  });
}

/* =====================================================================
   5. Tema: o wallpaper troca, o matugen gera as cores (colors.css) e o
      app se repinta numa onda de pixels. Menta, laranja, azul e menta.
   ===================================================================== */
const TEMA = {
  w: 960, h: 440, duracao: 6.4,
  estados: ["menta", "laranja", "azul"],
  trocas: [0.4, 2.4, 4.4],
  wall: { x: 32, y: 32, w: 400, h: 250 },
  amostras: { x: 32, y: 322, w: 88, h: 70, gap: 16 },
  jan: { x: 464, y: 32, w: 464, h: 376 },
  atrasoAmostra: 0.45, atrasoJanela: 0.8,
};

// Qual paleta vale para uma peça que muda `atraso` segundos depois da troca.
function estadoTema(t, atraso) {
  let n = 0;
  for (const s of TEMA.trocas) if (t >= s + atraso) n += 1;
  const atual = TEMA.estados[n % 3];
  const antes = TEMA.estados[(n + 2) % 3];
  return { atual, antes, t0: n ? TEMA.trocas[n - 1] + atraso : -Infinity };
}

function wallMini(c, tipo) {
  const pal = PALETAS[tipo];
  const { x, y, w, h } = TEMA.wall;
  c.save();
  c.beginPath();
  c.roundRect(x, y, w, h, 16);
  c.clip();
  c.translate(x, y);
  c.fillStyle = pal.win;
  c.fillRect(0, 0, w, h);
  if (tipo === "laranja") {
    // Pôr do sol com faixas, chapado.
    circulo(c, 200, 120, 76, pal.primary);
    c.fillStyle = pal.win;
    for (let k = 0; k < 5; k += 1) c.fillRect(110, 124 + k * 13, 180, 2 + k * 1.5);
    poligono(c, pal.secCont, [[0, 176], [70, 160], [150, 172], [240, 152], [330, 170], [400, 158], [400, 250], [0, 250]]);
    poligono(c, misturar(pal.terCont, "#000000", 0.25), [[0, 206], [110, 194], [210, 212], [320, 198], [400, 210], [400, 250], [0, 250]]);
    poligono(c, "#0d0906", [[0, 232], [150, 224], [280, 236], [400, 228], [400, 250], [0, 250]]);
  } else if (tipo === "azul") {
    // Mar à noite: lua e ondas em faixas.
    circulo(c, 130, 88, 48, pal.light);
    circulo(c, 152, 76, 42, pal.win);
    [[150, pal.terCont], [176, pal.secCont], [202, misturar(pal.secCont, "#000000", 0.45)], [226, "#07090c"]].forEach(([y0, cor], k) => {
      const pts = [];
      for (let px = 0; px <= w; px += 20) pts.push([px, y0 + Math.sin(px / (40 + k * 10) + k) * (7 - k)]);
      pts.push([w, h], [0, h]);
      poligono(c, cor, pts);
    });
  } else {
    // Montanhas e lua.
    circulo(c, 300, 72, 34, pal.tertiary);
    poligono(c, pal.terCont, [[0, 200], [60, 120], [120, 180], [190, 96], [270, 188], [340, 128], [400, 186], [400, 250], [0, 250]]);
    poligono(c, misturar(pal.secCont, "#000000", 0.2), [[0, 222], [90, 168], [170, 214], [260, 164], [360, 220], [400, 200], [400, 250], [0, 250]]);
    poligono(c, "#0b0a10", [[0, 240], [120, 222], [240, 240], [400, 226], [400, 250], [0, 250]]);
  }
  c.restore();
}

function janelaMini(c, pal, ang) {
  const { x: X, y: Y, w: WW, h: HH } = TEMA.jan;
  caixa(c, X, Y + 8, WW, HH, 14, "#050407");
  c.save();
  c.beginPath();
  c.roundRect(X, Y, WW, HH, 14);
  c.clip();
  // Cabeçalho.
  c.fillStyle = pal.header;
  c.fillRect(X, Y, WW, 40);
  c.fillStyle = rgba(pal.text, 0.1);
  c.fillRect(X, Y + 39, WW, 1);
  marca(c, X + 22, Y + 20, 18, 0, coresMarca(pal));
  texto(c, "Mosaic", X + 40, Y + 26, { peso: 600, tam: 15, cor: pal.text });
  caixa(c, X + 120, Y + 9, 200, 22, 11, pal.view);
  texto(c, "Buscar pacotes", X + 136, Y + 24, { tam: 11, fam: MONO, cor: rgba(pal.text, 0.55) });
  for (let k = 0; k < 3; k += 1) circulo(c, X + WW - 52 + k * 17, Y + 20, 5, rgba(pal.text, 0.26));
  // Lateral.
  c.fillStyle = pal.side;
  c.fillRect(X, Y + 40, 130, HH - 40);
  ["Descobrir", "Buscar", "Instalados", "Fila"].forEach((r, i) => {
    const y = Y + 52 + i * 32;
    const on = i === 0;
    if (on) caixa(c, X + 8, y, 114, 26, 7, pal.primary);
    circulo(c, X + 20, y + 13, 3, on ? pal.onPrimary : rgba(pal.text, 0.3));
    texto(c, r, X + 30, y + 18, { peso: on ? 600 : 500, tam: 12.5, cor: on ? pal.onPrimary : rgba(pal.text, 0.78) });
  });
  tecla(c, X + 8, Y + HH - 50, 114, 36, { face: pal.popup, raio: 8, E: 2 });
  marca(c, X + 24, Y + HH - 32, 12, 0, coresMarca(pal));
  texto(c, "Sincronizar", X + 38, Y + HH - 28, { peso: 600, tam: 11.5, cor: pal.text });
  // Conteúdo sobre o campo.
  fundoCampo(c, ang, X + 130, Y + 40, WW - 130, HH - 40, pal, { passo: 13, alpha: 0.34 });
  const fx = X + 146;
  const fy = Y + 56;
  caixa(c, fx, fy, 302, 108, 12, pal.secCont);
  c.save();
  c.beginPath();
  c.roundRect(fx, fy, 302, 108, 12);
  c.clip();
  c.fillStyle = rgba(pal.secondary, 0.45);
  for (let gx = fx + 150; gx < fx + 302; gx += 7) {
    const lado = Math.round(2.6 * ((gx - fx - 150) / 152));
    if (lado > 0) for (let gy = fy + 3; gy < fy + 108; gy += 7) c.fillRect(gx, gy, lado, lado);
  }
  c.restore();
  iconeApp(c, fx + 16, fy + 16, 56, "nvim-lazy", pal, 12);
  texto(c, "EM DESTAQUE", fx + 86, fy + 30, { peso: 600, tam: 9, fam: MONO, cor: pal.secondary, esp: 1.5 });
  texto(c, "nvim-lazy", fx + 86, fy + 52, { peso: 700, tam: 18, cor: pal.text });
  tecla(c, fx + 86, fy + 66, 82, 26, { face: pal.primary, raio: 7, E: 3 });
  texto(c, "Instalar", fx + 127, fy + 84, { peso: 600, tam: 12, cor: pal.onPrimary, alinhar: "center" });
  texto(c, "Populares", fx, Y + 190, { peso: 600, tam: 13, cor: pal.text });
  [["paru", "2.1.0-2"], ["yay", "13.0.1-1"]].forEach(([nome, versao], i) => {
    const cx = fx + i * 156;
    const cy = Y + 202;
    caixa(c, cx, cy, 146, 150, 12, pal.card);
    iconeApp(c, cx + 14, cy + 14, 40, nome, pal, 10);
    texto(c, nome, cx + 14, cy + 78, { peso: 700, tam: 15, cor: pal.text });
    texto(c, versao, cx + 14, cy + 96, { tam: 11, fam: MONO, cor: rgba(pal.text, 0.62) });
    seloG(c, cx + 14, cy + 112, "AUR", pal, false, 1);
    tecla(c, cx + 74, cy + 108, 60, 26, { face: pal.popup, raio: 7, E: 2 });
    texto(c, "Instalar", cx + 104, cy + 125, { peso: 600, tam: 11, cor: pal.text, alinhar: "center" });
  });
  c.restore();
}

function amostra(c, t, j, x, y) {
  const { w, h } = TEMA.amostras;
  const atraso = TEMA.atrasoAmostra + j * 0.08;
  const { atual, antes, t0 } = estadoTema(t, atraso);
  // A tecla afunda com a cor velha e volta com a nova.
  const a = aperto(t, t0, 0.03);
  const nome = t >= t0 + 0.05 ? atual : antes;
  const pal = PALETAS[nome];
  const cor = [pal.primary, pal.secondary, pal.tertiary, pal.light][j];
  const yf = tecla(c, x, y, w, h, { face: cor, raio: 12, afundar: a, E: 6 });
  texto(c, cor, x + w / 2, yf + 42, { peso: 500, tam: 14.5, fam: MONO, cor: misturar(cor, "#000000", 0.78), alinhar: "center" });
}

function desenharTema(c, t) {
  const ang = (TAU * t) / TEMA.duracao;
  c.fillStyle = "#0c0b10";
  c.fillRect(0, 0, TEMA.w, TEMA.h);

  // O wallpaper.
  const w = TEMA.wall;
  const ew = estadoTema(t, 0);
  onda(c, t, ew.t0, {
    x0: w.x, y0: w.y, w: w.w, h: w.h, raio: 16, ox: w.x, oy: w.y, passo: 25, espalhar: 0.26, ang, pal: PALETAS[ew.atual],
    velho: (cc) => wallMini(cc, ew.antes),
    novo: (cc) => wallMini(cc, ew.atual),
  });

  // O colors.css do matugen: quatro amostras.
  texto(c, "~/.config/mosaic-store/colors.css", 32, 308, { tam: 14, fam: MONO, cor: rgba(PALETAS.menta.text, 0.55) });
  const a = TEMA.amostras;
  for (let j = 0; j < 4; j += 1) amostra(c, t, j, a.x + j * (a.w + a.gap), a.y);

  // A janela do app.
  const jn = TEMA.jan;
  const ej = estadoTema(t, TEMA.atrasoJanela);
  onda(c, t, ej.t0, {
    x0: jn.x, y0: jn.y, w: jn.w, h: jn.h, raio: 14, ox: jn.x, oy: jn.y + jn.h / 2, passo: 24, espalhar: 0.34, ang, pal: PALETAS[ej.atual],
    velho: (cc) => janelaMini(cc, PALETAS[ej.antes], ang),
    novo: (cc) => janelaMini(cc, PALETAS[ej.atual], ang),
  });
}

/* =====================================================================
   O catálogo que o render percorre
   ===================================================================== */
export const GIFS = {
  marca: { w: MARCA_GIF.lado, h: MARCA_GIF.lado, duracao: 4, transparente: true, desenhar: desenharMarca },
  descobrir: { w: DESC.w, h: DESC.h, duracao: DESC.duracao, desenhar: desenharDescobrir },
  buscar: { w: BUS.w, h: BUS.h, duracao: BUS.duracao, desenhar: desenharBuscar },
  instalar: { w: INS.w, h: INS.h, duracao: INS.duracao, desenhar: desenharInstalar },
  tema: { w: TEMA.w, h: TEMA.h, duracao: TEMA.duracao, desenhar: desenharTema },
};
