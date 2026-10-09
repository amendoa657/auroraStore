// Mosaic — filme de apresentação de 30 s.
//
// Contrato: `seek(t)` pinta o quadro do tempo t do zero. Nada de transição
// CSS, timers ou estado entre quadros: tudo é função de t, e o "acaso" vem
// do mulberry32 com sementes fixas. O tempo das batidas vem de beats.json,
// medido na própria trilha, e os momentos do roteiro estão em cues.js.
import { CARTOES, CUE, LINK, PASSO_DIGITAR, SUBTITULO, contador, tomDe } from "./cues.js";
import {
  DISP, MONO, PALETAS, PRETO, QUEDA, acaso, aperto, borda, cair, caixa, campo, carregarFontes,
  circulo, corDoCampo, corTom, coresMarca, cortar, cursor, fonte, forcaLente, iconeApp,
  ladoDoCampo, lerp, limitar, marca, meio, misturar, rgba, saida, selo, tecla, texto, trecho,
} from "./base.js";

const W = 1920;
const H = 1080;
const tela = document.getElementById("filme");
const ctx = tela.getContext("2d");
// Rascunho para amostrar texto quando ele vira pixel (limpo a cada uso).
const rascunho = document.createElement("canvas");
rascunho.width = W;
rascunho.height = H;
const rctx = rascunho.getContext("2d", { willReadFrequently: true });

let BATIDAS = null;
let LARG_CARACTERE = 0;

export async function preparar() {
  await carregarFontes();
  BATIDAS = (await (await fetch("build/beats.json", { cache: "no-store" })).json()).beats;
  fonte(ctx, 400, TERM.tam, MONO);
  LARG_CARACTERE = ctx.measureText("M").width;
}

/* =====================================================================
   Tempo e matemática
   ===================================================================== */
// Batida (pode ser fracionária) -> segundos, pela grade medida.
function tb(b) {
  const n = BATIDAS.length;
  if (b <= 0) return BATIDAS[0] + b * (BATIDAS[1] - BATIDAS[0]);
  const i = Math.floor(b);
  if (i >= n - 1) return BATIDAS[n - 1] + (b - (n - 1)) * (BATIDAS[n - 1] - BATIDAS[n - 2]);
  return BATIDAS[i] + (b - i) * (BATIDAS[i + 1] - BATIDAS[i]);
}

function giros(t, batidas) {
  let g = 0;
  for (const b of batidas) g += meio(trecho(t, tb(b), tb(b) + 0.36));
  return g;
}

/* =====================================================================
   O campo de pixels (a mesma conta do pixels.js do app)
   ===================================================================== */
// No filme o campo anda 4x mais rápido que no app: 30 s precisam mostrar movimento.
const tempoCampo = (t) => 31 + t * 4;

function desenharCampo(c, t, rx, ry, rw, rh, pal, { passo = 24, escala = 1.6, lente = null, alpha = 0.42, fundo = pal.view, ox = 0 } = {}) {
  c.fillStyle = fundo;
  c.fillRect(rx, ry, rw, rh);
  const tf = tempoCampo(t);
  const s = passo / 15;
  const cores = [pal.primary, pal.secondary, pal.tertiary];
  const caminhos = [new Path2D(), new Path2D(), new Path2D()];
  const neutro = new Path2D();
  const i0 = Math.floor((rx + ox) / passo);
  const i1 = Math.ceil((rx + rw + ox) / passo);
  const j0 = Math.floor(ry / passo);
  const j1 = Math.ceil((ry + rh) / passo);
  for (let j = j0; j <= j1; j += 1) {
    const y = j * passo + passo / 2;
    for (let i = i0; i <= i1; i += 1) {
      const xg = i * passo + passo / 2;
      const x = xg - ox;
      const [k, f] = corDoCampo(xg / escala, y / escala, tf);
      const { lado, neutro: n } = ladoDoCampo(f, forcaLente(x, y, lente), s);
      (n ? neutro : caminhos[k]).rect(x - lado / 2, y - lado / 2, lado, lado);
    }
  }
  c.save();
  c.beginPath();
  c.rect(rx, ry, rw, rh);
  c.clip();
  c.fillStyle = rgba(pal.text, 0.12);
  c.fill(neutro);
  for (let k = 0; k < 3; k += 1) {
    c.fillStyle = rgba(cores[k], alpha);
    c.fill(caminhos[k]);
  }
  c.restore();
}

/* =====================================================================
   Ondas de pixels
   ===================================================================== */
function alcanceDe(rx, ry, rw, rh, ox, oy) {
  return Math.max(Math.hypot(ox - rx, oy - ry), Math.hypot(rx + rw - ox, oy - ry), Math.hypot(ox - rx, ry + rh - oy), Math.hypot(rx + rw - ox, ry + rh - oy));
}

// A onda revela: célula coberta mostra o "velho"; quando a onda chega,
// ela acende numa cor do campo e encolhe, deixando o "novo" aparecer.
function ondaRevela(c, t, t0, { rx, ry, rw, rh, ox, oy, passo, espalhar, encolher, velho, novo, pal }) {
  novo(c);
  const tf = tempoCampo(t);
  const alcance = alcanceDe(rx, ry, rw, rh, ox, oy);
  const cobertas = new Path2D();
  const acesas = [new Path2D(), new Path2D(), new Path2D()];
  let algumaCoberta = false;
  const cols = Math.ceil(rw / passo);
  const lins = Math.ceil(rh / passo);
  for (let j = 0; j < lins; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = rx + i * passo;
      const y = ry + j * passo;
      const cx = x + passo / 2;
      const cy = y + passo / 2;
      const atraso = (Math.hypot(cx - ox, cy - oy) / alcance) * espalhar + acaso(i, j, 41) * 0.03;
      const p = (t - t0 - atraso) / encolher;
      if (p <= 0) {
        cobertas.rect(x, y, passo + 0.5, passo + 0.5);
        algumaCoberta = true;
      } else if (p < 1) {
        const lado = (passo - 2) * (1 - saida(p));
        const [k] = corDoCampo(cx / 1.6, cy / 1.6, tf);
        acesas[k].rect(cx - lado / 2, cy - lado / 2, lado, lado);
      }
    }
  }
  c.save();
  c.beginPath();
  c.rect(rx, ry, rw, rh);
  c.clip();
  if (algumaCoberta) {
    c.save();
    c.clip(cobertas);
    velho(c);
    c.restore();
  }
  const cores = [pal.primary, pal.secondary, pal.tertiary];
  for (let k = 0; k < 3; k += 1) {
    c.fillStyle = cores[k];
    c.fill(acesas[k]);
  }
  c.restore();
}

// A onda cobre: cada célula nasce como um quadradinho colorido e cresce
// até fechar. `cheia` é a cor da célula fechada (null = a cor do campo).
function ondaCobre(c, t, t0, { rx, ry, rw, rh, ox, oy, passo, espalhar, crescer, cheia, pal, alinharGlobal = false }) {
  const tf = tempoCampo(t);
  const alcance = alcanceDe(rx, ry, rw, rh, ox, oy);
  const cores = [pal.primary, pal.secondary, pal.tertiary];
  const fechadas = new Path2D();
  const porCor = [new Path2D(), new Path2D(), new Path2D()];
  const i0 = alinharGlobal ? Math.floor(rx / passo) : 0;
  const j0 = alinharGlobal ? Math.floor(ry / passo) : 0;
  const cols = Math.ceil(rw / passo) + 1;
  const lins = Math.ceil(rh / passo) + 1;
  for (let j = j0; j < j0 + lins; j += 1) {
    for (let i = i0; i < i0 + cols; i += 1) {
      const x = alinharGlobal ? i * passo : rx + i * passo;
      const y = alinharGlobal ? j * passo : ry + j * passo;
      const cx = x + passo / 2;
      const cy = y + passo / 2;
      const atraso = (Math.hypot(cx - ox, cy - oy) / alcance) * espalhar + acaso(i, j, 77) * 0.04;
      const p = (t - t0 - atraso) / crescer;
      if (p <= 0) continue;
      const [k] = corDoCampo(cx / 1.6, cy / 1.6, tf);
      if (p >= 1) {
        (cheia ? fechadas : porCor[k]).rect(x, y, passo + 0.5, passo + 0.5);
      } else {
        const lado = passo * saida(p);
        porCor[k].rect(cx - lado / 2, cy - lado / 2, lado, lado);
      }
    }
  }
  if (cheia) {
    c.fillStyle = cheia;
    c.fill(fechadas);
  }
  for (let k = 0; k < 3; k += 1) {
    c.fillStyle = cores[k];
    c.fill(porCor[k]);
  }
}

// Texto que vira pixel e encolhe: desenha no rascunho, amostra numa grade
// e troca cada pedaço de letra por um quadradinho que some da esquerda
// para a direita.
function pixelSaida(c, t, t0, desenhar, { x0, y0, x1, y1 }, cor, G = 12) {
  rctx.clearRect(0, 0, W, H);
  desenhar(rctx);
  const w = Math.round(x1 - x0);
  const h = Math.round(y1 - y0);
  const dados = rctx.getImageData(Math.round(x0), Math.round(y0), w, h).data;
  const caminho = new Path2D();
  for (let gy = 0; gy < h; gy += G) {
    for (let gx = 0; gx < w; gx += G) {
      const px = Math.min(gx + (G >> 1), w - 1);
      const py = Math.min(gy + (G >> 1), h - 1);
      if (dados[(py * w + px) * 4 + 3] < 110) continue;
      const atraso = (gx / w) * 0.14 + acaso(gx, gy, 5) * 0.03;
      const q = (t - t0 - atraso) / 0.16;
      if (q >= 1) continue;
      const lado = (G - 1) * (1 - saida(limitar(q)));
      caminho.rect(x0 + gx + (G - lado) / 2, y0 + gy + (G - lado) / 2, lado, lado);
    }
  }
  c.fillStyle = cor;
  c.fill(caminho);
}

/* =====================================================================
   Legendas (texto grande à esquerda): cada palavra entra como tecla
   ===================================================================== */
function legenda(c, t, { linhas, x, y, tam, entrelinha, tempos, cor, saiT = null, peso = 700, fam = DISP }) {
  fonte(c, peso, tam, fam);
  const espaco = c.measureText(" ").width;
  const palavras = [];
  let n = 0;
  let maxX = x;
  linhas.forEach((linha, li) => {
    let cx = x;
    for (const p of linha.split(" ")) {
      palavras.push({ p, x: cx, y: y + li * entrelinha, t0: tempos[Math.min(n, tempos.length - 1)] });
      cx += c.measureText(p).width + espaco;
      maxX = Math.max(maxX, cx);
      n += 1;
    }
  });
  const estatico = (cc) => {
    fonte(cc, peso, tam, fam);
    cc.fillStyle = cor;
    for (const w of palavras) if (t >= w.t0) cc.fillText(w.p, w.x, w.y);
  };
  if (saiT !== null && t >= saiT) {
    pixelSaida(c, t, saiT, estatico, { x0: x - 10, y0: y - tam, x1: maxX + 10, y1: y + (linhas.length - 1) * entrelinha + tam * 0.35 }, cor, Math.max(8, Math.round(tam / 9)));
    return;
  }
  for (const w of palavras) {
    const e = cair(t, w.t0, 46, Math.max(5, tam * 0.07));
    if (!e) continue;
    fonte(c, peso, tam, fam);
    if (e.borda) {
      c.fillStyle = "#2c2733";
      c.fillText(w.p, w.x, w.y);
    }
    c.fillStyle = cor;
    c.fillText(w.p, w.x, w.y + e.dy);
  }
}

/* =====================================================================
   A janela do app (desenhada em "px do app", escalada por U)
   ===================================================================== */
const JAN = { y: 96, w: 1140, h: 888, U: 1.25 };
const AW = JAN.w / JAN.U;
const AH = JAN.h / JAN.U;

function janela(c, x, y, pal, conteudo, zoom = null) {
  c.save();
  if (zoom) {
    c.translate(zoom.px, zoom.py);
    c.scale(zoom.z, zoom.z);
    c.translate(-zoom.ax, -zoom.ay);
  }
  // A janela também é uma tecla: borda escura embaixo, sem brilho.
  caixa(c, x, y + 12, JAN.w, JAN.h, 16, "#050407");
  c.save();
  c.beginPath();
  c.roundRect(x, y, JAN.w, JAN.h, 16);
  c.clip();
  c.translate(x, y);
  c.scale(JAN.U, JAN.U);
  conteudo(c);
  c.restore();
  c.restore();
}


function cabecalho(c, pal, tipo, extra = {}) {
  c.fillStyle = pal.header;
  c.fillRect(0, 0, AW, 44);
  c.fillStyle = rgba(pal.text, 0.1);
  c.fillRect(0, 43, AW, 1);
  if (tipo === "voltar") {
    tecla(c, 14, 8, 86, 27, { face: pal.popup, raio: 7, E: 2 });
    texto(c, "← Voltar", 26, 26, { peso: 600, tam: 12.5, cor: pal.text });
    texto(c, extra.trilha, 114, 26, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.62) });
  } else {
    marca(c, 22, 22, 17, 0, coresMarca(pal));
    texto(c, tipo === "fila" ? "Fila de instalação" : "Mosaic", 40, 27, { peso: 600, tam: 14.5, cor: pal.text });
  }
  if (tipo === "busca") {
    caixa(c, 124, 8, 330, 28, 8, pal.view);
    c.strokeStyle = rgba(pal.text, 0.6);
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(140, 22, 5, 0, Math.PI * 2);
    c.stroke();
    texto(c, "Buscar pacotes", 154, 26, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.62) });
    caixa(c, 428, 14, 18, 16, 4, pal.popup);
    texto(c, "/", 437, 26, { tam: 10.5, fam: MONO, cor: rgba(pal.text, 0.62), alinhar: "center" });
  }
  if (tipo === "fila") {
    texto(c, "1 de 4 concluídos", 182, 27, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.62) });
    tecla(c, AW - 186, 8, 112, 28, { face: "#5a1a1f", raio: 7, E: 2 });
    texto(c, "Cancelar tudo", AW - 130, 26.5, { peso: 600, tam: 12, cor: pal.danger, alinhar: "center" });
  }
  for (let k = 0; k < 3; k += 1) circulo(c, AW - (tipo === "fila" ? 52 : 50) + k * 19 + (tipo === "fila" ? 0 : 0), 22, 6, rgba(pal.text, 0.26));
}

function lateral(c, pal, ativo) {
  c.fillStyle = pal.side;
  c.fillRect(0, 44, 200, AH - 44);
  c.fillStyle = rgba(pal.text, 0.08);
  c.fillRect(199, 44, 1, AH - 44);
  ["Descobrir", "Buscar", "Instalados", "Atualizações", "Fila", "Configurações"].forEach((r, i) => {
    const y = 56 + i * 36;
    const on = r === ativo;
    if (on) caixa(c, 10, y, 180, 32, 8, pal.primary);
    circulo(c, 26, y + 16, 3.5, on ? pal.onPrimary : rgba(pal.text, 0.3));
    texto(c, r, 40, y + 21, { peso: on ? 600 : 500, tam: 13, cor: on ? pal.onPrimary : rgba(pal.text, 0.78) });
  });
  c.fillStyle = rgba(pal.text, 0.1);
  c.fillRect(14, 282, 172, 1);
  texto(c, "FONTES", 22, 306, { peso: 600, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), esp: 1.6 });
  texto(c, "1/1", 178, 306, { peso: 500, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), alinhar: "right" });
  caixa(c, 22, 322, 10, 10, 2, pal.secondary);
  texto(c, "aur", 42, 331, { peso: 500, tam: 12, fam: MONO, cor: pal.text });
  texto(c, "on", 178, 331, { peso: 500, tam: 10, fam: MONO, cor: pal.secondary, alinhar: "right" });
  const ys = AH - 60;
  tecla(c, 10, ys, 180, 46, { face: pal.popup, raio: 9, E: 2 });
  marca(c, 30, ys + 23, 15, 0, coresMarca(pal));
  texto(c, "Sincronizar mirrors", 48, ys + 20, { peso: 600, tam: 12, cor: pal.text });
  texto(c, "core · extra · aur", 48, ys + 36, { peso: 500, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62) });
}

function areaConteudo(c, t, pal, x0, lente) {
  desenharCampo(c, t, x0, 44, AW - x0, AH - 44, pal, { passo: 15, escala: 1, lente, alpha: 0.34, fundo: pal.view });
}


const DADOS_CARTOES = {
  "aur-sync-vote": ["0.3.0-1", "Syncing votes with the currently installed AUR packages"],
  paru: ["2.1.0-2", "Feature packed AUR helper"],
  yay: ["13.0.1-1", "Yet another yogurt. Pacman wrapper and AUR helper written in go."],
  "brave-origin-bin": ["1:1.97.56-1", "The minimalist browser from the makers of Brave (binary release)."],
  "faugus-launcher": ["2.4.4-1", "A simple and lightweight app for running Windows games using UMU-Launcher"],
  "chatgpt-desktop": ["26.1002.52244-1", "ChatGPT desktop application for Linux (repackaged from the official binary)"],
};

function quebrar(c, s, max, linhas) {
  const palavras = s.split(" ");
  const out = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? atual + " " + p : p;
    if (c.measureText(teste).width > max && atual) {
      out.push(atual);
      atual = p;
      if (out.length === linhas - 1) break;
    } else atual = teste;
  }
  out.push(out.length === linhas - 1 ? cortar(c, palavras.slice(out.join(" ").split(" ").length).join(" ") || atual, max) : atual);
  return out.slice(0, linhas);
}

const CART = { x: 222, y: 258, w: (AW - 244 - 14) / 2, h: 148, gap: 14 };
const posCartao = (i) => ({ x: CART.x + (i % 2) * (CART.w + CART.gap), y: CART.y + Math.floor(i / 2) * (CART.h + 16) });

function telaInicio(c, t, pal, { cartoesT = null, hover = -1, lente = null } = {}) {
  cabecalho(c, pal, "busca");
  lateral(c, pal, "Descobrir");
  areaConteudo(c, t, pal, 200, lente);

  // Destaque: no container secundário, com retícula entrando pela direita.
  const dx = 222, dy = 62, dw = AW - 244, dh = 150;
  caixa(c, dx, dy, dw, dh, 14, pal.secCont);
  c.save();
  c.beginPath();
  c.roundRect(dx, dy, dw, dh, 14);
  c.clip();
  c.fillStyle = rgba(pal.secondary, 0.45);
  for (let gx = dx + dw * 0.45; gx < dx + dw; gx += 9) {
    const lado = 3.2 * ((gx - dx - dw * 0.45) / (dw * 0.55));
    for (let gy = dy + 3; gy < dy + dh; gy += 9) c.fillRect(gx, gy, lado, lado);
  }
  c.restore();
  iconeApp(c, dx + 22, dy + 24, 100, "nvim-lazy", pal, 20);
  texto(c, "EM DESTAQUE", dx + 146, dy + 40, { peso: 600, tam: 10, fam: MONO, cor: pal.secondary, esp: 2 });
  texto(c, "nvim-lazy", dx + 146, dy + 70, { peso: 700, tam: 24, cor: pal.text });
  texto(c, "A modern plugin manager for Neovim.", dx + 146, dy + 94, { tam: 13, cor: rgba(pal.text, 0.78) });
  tecla(c, dx + 146, dy + 108, 100, 32, { face: pal.primary, raio: 7, E: 3 });
  texto(c, "Instalar", dx + 196, dy + 129, { peso: 600, tam: 13, cor: pal.onPrimary, alinhar: "center" });
  const ws = selo(c, dx + 258, dy + 114, "AUR", pal);
  texto(c, "1:v11.17.5-1", dx + 268 + ws, dy + 128, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.62) });

  texto(c, "Populares esta semana", 222, 244, { peso: 600, tam: 15, cor: pal.text });
  texto(c, "Ver tudo", AW - 22, 244, { tam: 12, cor: pal.primary, alinhar: "right" });

  CARTOES.forEach((nome, i) => {
    const t0 = cartoesT ? cartoesT[i] : -1;
    const e = cartoesT ? cair(t, t0, 30, 4) : { dy: 0, borda: false };
    if (!e) return;
    const { x, y: y0 } = posCartao(i);
    const emHover = i === hover;
    const y = y0 + e.dy - (emHover ? 3 : 0);
    const cor = corTom(pal, tomDe(nome));
    if (e.borda || emHover) caixa(c, x, y0 + (emHover ? 1 : 0), CART.w, CART.h, 12, "#08070b");
    caixa(c, x, y, CART.w, CART.h, 12, emHover ? pal.cardHover : pal.card);
    c.strokeStyle = emHover ? rgba(cor, 0.6) : rgba(pal.text, 0.09);
    c.lineWidth = emHover ? 1.5 : 1;
    c.beginPath();
    c.roundRect(x + 0.5, y + 0.5, CART.w - 1, CART.h - 1, 12);
    c.stroke();
    // O ícone entra como carimbo: um pouco maior e assenta.
    const carimbo = cartoesT ? 1 + 0.35 * (1 - saida(trecho(t, t0, t0 + 0.14))) : 1;
    c.save();
    c.translate(x + 36, y + 36);
    c.scale(carimbo, carimbo);
    iconeApp(c, -21, -21, 42, nome, pal);
    c.restore();
    const [versao, desc] = DADOS_CARTOES[nome];
    texto(c, nome, x + 68, y + 33, { peso: 600, tam: 13.5, cor: emHover ? cor : pal.text });
    texto(c, versao, x + 68, y + 51, { tam: 11, fam: MONO, cor: rgba(pal.text, 0.62) });
    fonte(c, 400, 12);
    quebrar(c, desc, CART.w - 30, 2).forEach((l, k) => texto(c, l, x + 15, y + 82 + k * 17, { tam: 12, cor: rgba(pal.text, 0.78) }));
    selo(c, x + 15, y + 116, "AUR", pal);
    tecla(c, x + CART.w - 88, y + 110, 74, 27, { face: pal.popup, raio: 7, E: 2 });
    texto(c, "Instalar", x + CART.w - 51, y + 128, { peso: 600, tam: 12, cor: pal.text, alinhar: "center" });
  });
}

const RESULTADOS = [
  ["firefox", "Fast, Private & Safe Web Browser", "157.0.1-1", "0", "extra"],
  ["firefox-vencord", "The cutest Discord client mod", "1.15.10-1", "11", "aur"],
  ["firefox-developer-edition-vencord", "The cutest Discord client mod", "1.15.10-1", "11", "aur"],
  ["firefox-extension-ruffle-nightly", "A Flash Player emulator written in Rust. (Nightly version)", "0.8.0+nightly+", "2", "aur"],
  ["firefox-extension-connective-signing", "Connective Signing Extension for Firefox", "1.0.5-1", "2", "aur"],
  ["firefox-gnome-theme", "A GNOME theme for Firefox", "157-1", "11", "aur"],
  ["firefox-esr", "Standalone web browser from mozilla.org, Extended Support Release", "153.4.0-1", "52", "aur"],
  ["firefox-esr-i18n-ach", "Standalone web browser from mozilla.org, Extended Support Release", "153.4.0-1", "52", "aur"],
  ["firefox-esr-i18n-af", "Standalone web browser from mozilla.org, Extended Support Release", "153.4.0-1", "52", "aur"],
];
const LINHA_ALVO = 5; // firefox-gnome-theme
const BUSCA = { campoX: 336, campoY: 62, linhasY: 228, alturaLinha: 54 };

function telaBusca(c, t, pal, { digitado = "", foco = true, enterT = Infinity, hover = -1 } = {}) {
  cabecalho(c, pal, "sem-busca");
  lateral(c, pal, "Buscar");
  areaConteudo(c, t, pal, 200, null);
  c.fillStyle = pal.view;
  c.fillRect(200, 44, AW - 200, 116);
  const fx = BUSCA.campoX;
  const fy = BUSCA.campoY;
  caixa(c, fx, fy, 440, 42, 21, pal.card);
  c.strokeStyle = foco ? pal.primary : rgba(pal.text, 0.12);
  c.lineWidth = 1.6;
  c.beginPath();
  c.roundRect(fx, fy, 440, 42, 21);
  c.stroke();
  c.strokeStyle = rgba(pal.text, 0.75);
  c.lineWidth = 2;
  c.beginPath();
  c.arc(fx + 24, fy + 21, 6, 0, Math.PI * 2);
  c.stroke();
  if (digitado) texto(c, digitado, fx + 42, fy + 27, { tam: 14, fam: MONO, cor: pal.text });
  else texto(c, "Buscar pacotes", fx + 42, fy + 27, { tam: 14, fam: MONO, cor: rgba(pal.text, 0.5) });
  fonte(c, 400, 14, MONO);
  const cx = fx + 43 + (digitado ? c.measureText(digitado).width : 0);
  if (foco && Math.floor(t * 2.4) % 2 === 0) {
    c.fillStyle = pal.primary;
    c.fillRect(cx, fy + 12, 2, 18);
  }
  if (digitado) {
    circulo(c, fx + 414, fy + 21, 11, pal.popup);
    texto(c, "✕", fx + 414, fy + 25, { tam: 10, cor: rgba(pal.text, 0.78), alinhar: "center" });
  }
  caixa(c, 482, 114, 44, 26, 13, pal.primary);
  texto(c, "AUR", 504, 131, { peso: 600, tam: 12, cor: pal.onPrimary, alinhar: "center" });
  caixa(c, 532, 114, 146, 26, 13, pal.popup);
  texto(c, "Repositórios Oficiais", 605, 131, { tam: 12, cor: rgba(pal.text, 0.78), alinhar: "center" });

  if (t < enterT) return;
  c.fillStyle = pal.side2;
  c.fillRect(200, 160, AW - 200, 40);
  texto(c, "745 resultados na AUR", 218, 185, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.62) });
  c.fillStyle = pal.view;
  c.fillRect(200, 200, AW - 200, 28);
  [["PACOTE", 218], ["VERSÃO", 612], ["VOTOS", 718], ["FONTE", 790]].forEach(([r, x]) => texto(c, r, x, 219, { peso: 600, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), esp: 1.2 }));
  RESULTADOS.forEach((r, i) => {
    const t0 = enterT + i * 0.0625;
    const e = cair(t, t0, 22, 0);
    if (!e) return;
    const y = BUSCA.linhasY + i * BUSCA.alturaLinha + e.dy;
    c.fillStyle = i === hover ? rgba(pal.tertiary, 0.18) : pal.view;
    c.fillRect(200, y, AW - 200, BUSCA.alturaLinha);
    c.fillStyle = rgba(pal.tertiary, 0.12);
    c.fillRect(200, y + BUSCA.alturaLinha - 1, AW - 200, 1);
    fonte(c, 600, 13, MONO);
    texto(c, cortar(c, r[0], 370), 218, y + 23, { peso: 600, tam: 13, fam: MONO, cor: i === hover ? pal.primary : pal.text });
    fonte(c, 400, 11.5);
    texto(c, cortar(c, r[1], 370), 218, y + 41, { tam: 11.5, cor: rgba(pal.text, 0.78) });
    texto(c, r[2], 612, y + 31, { tam: 11.5, fam: MONO, cor: rgba(pal.text, 0.78) });
    texto(c, r[3], 718, y + 31, { tam: 12, fam: MONO, cor: pal.text });
    selo(c, 790, y + 17, r[4] === "aur" ? "AUR" : r[4], pal, r[4] !== "aur");
  });
}

const PKGBUILD = [
  "# Maintainer: FunctionalHacker",
  "pkgname=firefox-gnome-theme",
  "pkgver=157",
  "pkgrel=1",
  "pkgdesc='A GNOME theme for Firefox'",
  "arch=('any')",
  "url='https://github.com/rafaelmardojai/firefox-gnome-theme'",
  "",
  "package() {",
  '  cd "$srcdir/$pkgname-$pkgver"',
  "  …",
  "}",
];
const CHAVES = ["pkgname", "pkgver", "pkgrel", "pkgdesc", "arch", "url", "package"];
const INSTALAR = { x: 482, y: 74, w: 116, h: 38 };

function telaPacote(c, t, pal, { avisoT = Infinity, pkgT = Infinity, linhasT = Infinity, afundar = 0 } = {}) {
  cabecalho(c, pal, "voltar", { trilha: "aur / firefox-gnome-theme" });
  areaConteudo(c, t, pal, 0, null);
  const mw = AW - 292;
  // Painel lateral.
  c.fillStyle = pal.side;
  c.fillRect(mw, 44, 292, AH - 44);
  c.fillStyle = rgba(pal.text, 0.08);
  c.fillRect(mw, 44, 1, AH - 44);
  texto(c, "DETALHES", mw + 22, 82, { peso: 600, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), esp: 1.6 });
  [["Votos AUR", "11"], ["Mantenedor", "FunctionalHacker"], ["Versão", "157-1"]].forEach(([k, v], i) => {
    texto(c, k, mw + 22, 112 + i * 26, { tam: 12.5, cor: rgba(pal.text, 0.78) });
    texto(c, v, AW - 22, 112 + i * 26, { tam: 12.5, fam: MONO, cor: pal.text, alinhar: "right" });
  });
  c.fillStyle = rgba(pal.text, 0.1);
  c.fillRect(mw + 22, 200, 248, 1);
  texto(c, "PROJETO", mw + 22, 228, { peso: 600, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), esp: 1.6 });
  texto(c, "github.com/rafaelmardojai/", mw + 22, 252, { tam: 11.5, fam: MONO, cor: pal.primary });
  texto(c, "firefox-gnome-theme", mw + 22, 270, { tam: 11.5, fam: MONO, cor: pal.primary });

  // Identidade e o botão Instalar.
  iconeApp(c, 24, 64, 78, "firefox-gnome-theme", pal, 18);
  texto(c, "firefox-gnome-theme", 118, 96, { peso: 700, tam: 22, cor: pal.text });
  fonte(c, 700, 22);
  selo(c, 126 + c.measureText("firefox-gnome-theme").width, 80, "AUR", pal);
  texto(c, "157-1 · mantido por FunctionalHacker", 118, 122, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.78) });
  const yf = tecla(c, INSTALAR.x, INSTALAR.y, INSTALAR.w, INSTALAR.h, { face: pal.primary, raio: 9, afundar, E: 4 });
  texto(c, "Instalar", INSTALAR.x + INSTALAR.w / 2, yf + 25, { peso: 600, tam: 14, cor: pal.onPrimary, alinhar: "center" });

  // O aviso da AUR: entra como tecla.
  const ea = cair(t, avisoT, 30, 5);
  if (ea) {
    const ax = 24, ay = 160, aw2 = mw - 48, ah2 = 108;
    if (ea.borda) caixa(c, ax, ay, aw2, ah2, 12, "#3a0306");
    const y = ay + ea.dy;
    caixa(c, ax, y, aw2, ah2, 12, "#4a0a10");
    c.strokeStyle = pal.danger;
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(ax + 26, y + 30, 11, 0, Math.PI * 2);
    c.stroke();
    texto(c, "!", ax + 26, y + 35, { peso: 700, tam: 13, cor: pal.danger, alinhar: "center" });
    texto(c, "Pacote da AUR — enviado por usuários", ax + 50, y + 35, { peso: 600, tam: 14, cor: pal.danger });
    texto(c, "Não é revisado pelos mantenedores do Arch. O PKGBUILD roda na sua", ax + 50, y + 58, { tam: 12, cor: pal.dangerText });
    texto(c, "máquina durante a compilação. Revise o script antes de continuar.", ax + 50, y + 75, { tam: 12, cor: pal.dangerText });
  }

  // O PKGBUILD abre e as linhas caem; as chaves acendem na cor de destaque.
  const ep = cair(t, pkgT, 30, 4);
  if (ep) {
    const px = 24, py = 286 + ep.dy, pw = mw - 48, ph = AH - 286 - 22;
    caixa(c, px, py, pw, ph, 12, pal.win);
    c.strokeStyle = rgba(pal.text, 0.08);
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(px + 0.5, py + 0.5, pw - 1, ph - 1, 12);
    c.stroke();
    texto(c, "PKGBUILD", px + 18, py + 28, { peso: 600, tam: 10, fam: MONO, cor: rgba(pal.text, 0.62), esp: 1.6 });
    texto(c, "firefox-gnome-theme 157-1", px + 104, py + 28, { tam: 10.5, fam: MONO, cor: rgba(pal.text, 0.5) });
    PKGBUILD.forEach((linha, i) => {
      const t0 = linhasT + i * 0.125;
      const e = cair(t, t0, 9, 0);
      if (!e || !linha) return;
      const y = py + 62 + i * 25 + e.dy;
      fonte(c, 400, 13, MONO);
      const chave = CHAVES.find((k) => linha.startsWith(k));
      if (chave && t >= t0 + 0.1) {
        texto(c, chave, px + 18, y, { tam: 13, fam: MONO, cor: pal.primary });
        texto(c, cortar(c, linha.slice(chave.length), pw - 60 - c.measureText(chave).width), px + 18 + c.measureText(chave).width, y, { tam: 13, fam: MONO, cor: rgba(pal.text, 0.78) });
      } else {
        texto(c, cortar(c, linha, pw - 50), px + 18, y, { tam: 13, fam: MONO, cor: linha.startsWith("#") ? rgba(pal.text, 0.5) : rgba(pal.text, 0.78) });
      }
    });
  }
}

const LOG_FILA = [
  ":: Resolvendo dependências...",
  ":: Procurando conflitos entre pacotes...",
  "==> Criando o pacote: firefox-gnome-theme 157-1",
  "==> Verificando dependências de tempo de execução...",
  "==> Verificando dependências de compilação...",
  "==> Obtendo fontes...",
  "  -> Baixando firefox-gnome-theme-157.tar.gz...",
  "  100  1.2M  100  1.2M    0     0  2.4M      0  0:00:01",
  "==> Validando arquivos source com sha256sums...",
  "    firefox-gnome-theme-157.tar.gz ... Passou",
  "==> Extraindo fontes...",
  "  -> Extraindo firefox-gnome-theme-157.tar.gz com bsdtar",
  "==> Iniciando package()...",
  "install -Dm644 theme/gnome-theme.css",
  "install -Dm644 theme/colors/dark.css",
  "install -Dm644 theme/colors/light.css",
  "install -Dm644 theme/parts/headerbar.css",
  "install -Dm644 theme/parts/tabsbar.css",
  "install -Dm644 theme/parts/toolbox.css",
  "install -Dm644 theme/parts/urlbar.css",
  "install -Dm644 theme/parts/popups.css",
  "install -Dm644 theme/parts/sidebar.css",
  "install -Dm644 theme/icons/*.svg",
  "install -Dm644 userChrome.css",
  "install -Dm644 userContent.css",
  "==> Organizando a instalação...",
  "  -> Removendo arquivos libtool...",
  "  -> Comprimindo man e info...",
  "==> Verificando problemas de empacotamento...",
  "==> Criando o pacote \"firefox-gnome-theme\"...",
  "  -> Gerando arquivo .PKGINFO...",
  "  -> Gerando arquivo .BUILDINFO...",
  "  -> Gerando arquivo .MTREE...",
  "  -> Comprimindo pacote...",
];
// Uma linha por semicolcheia: o log anda no tempo da música.
const PASSO_LOG = 0.125;
const CABEM_LOG = 23;

function telaFila(c, t, pal, { linhasT, progresso }) {
  cabecalho(c, pal, "fila");
  areaConteudo(c, t, pal, 0, null);
  const visiveis = LOG_FILA.filter((_, i) => t >= linhasT + i * PASSO_LOG);
  const passoAtual = visiveis.length ? visiveis[visiveis.length - 1].replace(/^[=\->\s]+/, "") : "Preparando pacotes...";
  const itens = [
    ["firefox-gnome-theme", "instalando"],
    ["visual-studio-code-bin", "aguardando na fila"],
    ["obsidian", "aguardando na fila"],
    ["paru", "instalado"],
  ];
  let y = 64;
  itens.forEach(([nome, estado], i) => {
    const h = i === 0 ? 104 : 72;
    caixa(c, 20, y + 2, 340, h, 12, "#08070b");
    caixa(c, 20, y, 340, h, 12, pal.card);
    if (estado === "instalado") {
      caixa(c, 38, y + 17, 38, 38, 10, pal.terCont);
      texto(c, "✓", 57, y + 42, { peso: 700, tam: 15, cor: pal.terText, alinhar: "center" });
    } else iconeApp(c, 38, y + 17, 38, nome, pal, 10);
    texto(c, nome, 90, y + 33, { peso: 600, tam: 13.5, fam: MONO, cor: pal.text });
    fonte(c, 400, 11.5);
    const cor = estado === "instalando" ? pal.primary : estado === "instalado" ? pal.tertiary : rgba(pal.text, 0.78);
    texto(c, cortar(c, estado === "instalando" ? passoAtual : estado, 230), 90, y + 51, { tam: 11.5, cor });
    if (i === 0) {
      texto(c, `${Math.round(progresso * 100)}%`, 342, y + 33, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.78), alinhar: "right" });
      caixa(c, 38, y + 78, 304, 6, 3, pal.popup);
      c.save();
      c.beginPath();
      c.roundRect(38, y + 78, 304 * progresso, 6, 3);
      c.clip();
      c.fillStyle = pal.primary;
      c.fillRect(38, y + 78, 304, 6);
      // Listras diagonais andando um período por batida.
      c.fillStyle = rgba(pal.onPrimary, 0.25);
      const desl = ((t / 0.5) % 1) * 14;
      for (let sx = 20 - 14 + desl; sx < 360; sx += 14) {
        c.beginPath();
        c.moveTo(sx, y + 84);
        c.lineTo(sx + 6, y + 78);
        c.lineTo(sx + 13, y + 78);
        c.lineTo(sx + 7, y + 84);
        c.fill();
      }
      c.restore();
    }
    y += h + 10;
  });
  // Terminal.
  const tx = 376, ty = 64, tw = AW - 396, th = AH - 84;
  caixa(c, tx, ty, tw, th, 12, pal.win);
  c.fillStyle = pal.side2;
  c.fillRect(tx, ty, tw, 36);
  texto(c, "SAÍDA DO BUILD", tx + 16, ty + 23, { peso: 600, tam: 11, fam: MONO, cor: rgba(pal.text, 0.78), esp: 1.2 });
  texto(c, "firefox-gnome-theme", tx + 140, ty + 23, { tam: 11, fam: MONO, cor: rgba(pal.text, 0.5) });
  // Quando a tela enche, o log sobe uma linha a cada linha nova.
  const passou = Math.max(0, (t - linhasT) / PASSO_LOG - (CABEM_LOG - 1));
  const rolar = Math.min(passou, LOG_FILA.length - CABEM_LOG) * 23;
  c.save();
  c.beginPath();
  c.rect(tx, ty + 40, tw, th - 48);
  c.clip();
  LOG_FILA.forEach((linha, i) => {
    const t0 = linhasT + i * PASSO_LOG;
    if (t < t0) return;
    const y = ty + 62 + i * 23 - rolar;
    if (y < ty + 30) return;
    const impresso = saida(trecho(t, t0, t0 + 0.1));
    c.save();
    c.beginPath();
    c.rect(tx, y - 16, 20 + (tw - 20) * impresso, 23);
    c.clip();
    fonte(c, 400, 12, MONO);
    if (linha.startsWith("==>")) {
      texto(c, "==>", tx + 16, y, { tam: 12, fam: MONO, cor: pal.primary });
      texto(c, cortar(c, linha.slice(3), tw - 70), tx + 46, y, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.85) });
    } else if (linha.startsWith("::")) {
      texto(c, "::", tx + 16, y, { tam: 12, fam: MONO, cor: pal.tertiary });
      texto(c, cortar(c, linha.slice(2), tw - 70), tx + 32, y, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.85) });
    } else texto(c, cortar(c, linha, tw - 40), tx + 16, y, { tam: 12, fam: MONO, cor: rgba(pal.text, 0.55) });
    c.restore();
  });
  const n = visiveis.length;
  if (n < LOG_FILA.length && Math.floor(t * 2.4) % 2 === 0) {
    c.fillStyle = pal.primary;
    c.fillRect(tx + 16, ty + 62 + n * 23 - 13 - rolar, 8, 15);
  }
  c.restore();
}

/* =====================================================================
   Cena 1–2: o terminal vira mosaico, a marca nasce
   ===================================================================== */
const TERM = { x: 72, y0: 70, lh: 40, tam: 30 };
const LOG_ABERTURA = [
  "==> Criando o pacote: chromium-wayland 142.0.7444.59-1",
  "==> Verificando dependências de compilação...",
  "==> Obtendo fontes...",
  "  -> Baixando chromium-142.0.7444.59.tar.xz...",
  "==> Validando arquivos source com sha256sums...",
  "    chromium-142.0.7444.59.tar.xz ... Passou",
  "==> Extraindo fontes...",
  "==> Iniciando prepare()...",
  "==> Iniciando build()...",
];
const PASTAS = ["third_party/blink/renderer/core/layout", "content/browser/renderer_host", "v8/src/compiler/backend", "components/viz/service/display", "net/http", "ui/gfx/geometry", "gpu/command_buffer/service", "media/gpu/vaapi", "third_party/skia/src/core", "cc/trees"];
const ARQUIVOS = ["layout_block", "render_widget_host_impl", "instruction_selector", "direct_renderer", "http_stream_parser", "rect_conversions", "gles2_cmd_decoder", "vaapi_wrapper", "SkCanvas", "layer_tree_host_impl", "paint_layer", "frame_tree_node"];
function linhaLog(k) {
  if (k < LOG_ABERTURA.length) return LOG_ABERTURA[k];
  const r = (s) => acaso(k, s);
  const total = 58291;
  const n = 1200 + k * 37 + Math.floor(r(1) * 30);
  const pasta = PASTAS[Math.floor(r(2) * PASTAS.length)];
  const arq = ARQUIVOS[Math.floor(r(3) * ARQUIVOS.length)];
  if (r(4) < 0.12) return `  -> warning: unused variable 'tmp_${Math.floor(r(5) * 90)}' [-Wunused-variable]`;
  return `[${n}/${total}] CXX obj/${pasta}/${arq}.o`;
}
// O log corre rápido e trava seco no clique da tecla "/".
const VEL_LOG = 900;
const rolagem = (t) => {
  const tp = tb(CUE.teclaAfunda);
  if (t <= tp) return VEL_LOG * t;
  return VEL_LOG * tp + 34 * saida(Math.min(1, (t - tp) / 0.12));
};
// Cor de cada letra do log: a seta "==>" e o contador [n/total] mais claros.
const CINZA_LOG = "#6f6979";
function corLetraLog(s, col) {
  if (s.startsWith("==>")) return col < 3 ? PALETAS.menta.primary : "#b4aec0";
  if (s.startsWith("[")) return col <= s.indexOf("]") ? "#a39daf" : CINZA_LOG;
  return CINZA_LOG;
}

// Todas as letras visíveis quando o terminal vira mosaico (fixas: a rolagem
// já parou). Calculado uma vez; depende só das constantes acima.
let LETRAS = null;
function letras() {
  if (LETRAS) return LETRAS;
  const off = rolagem(tb(CUE.pixelizar));
  const lista = [];
  const k0 = Math.max(0, Math.floor((off - TERM.y0) / TERM.lh) - 1);
  const tf = tempoCampo(tb(CUE.pixelizar));
  for (let k = k0; k < k0 + 32; k += 1) {
    const y = TERM.y0 + k * TERM.lh - off;
    if (y < 10 || y > H + 20) continue;
    const s = linhaLog(k);
    for (let col = 0; col < s.length; col += 1) {
      if (s[col] === " ") continue;
      const x = TERM.x + col * LARG_CARACTERE;
      if (x > W - 20) break;
      const tc = tb(CUE.pixelizar) + (col / 105) * (tb(CUE.pixelizarFim) - tb(CUE.pixelizar)) + acaso(k, col, 7) * 0.04;
      const [cor] = corDoCampo(x / 1.6, y / 1.6, tf);
      lista.push({ x, y, ch: s[col], k, col, tc, cor, cor0: corLetraLog(s, col), i: lista.length });
    }
  }
  LETRAS = lista;
  return lista;
}

const MARCA = { cx: 258, cy: 438, tam: 216 };
function alvosMarca() {
  const b = MARCA.tam * 0.44;
  const pos = [[-MARCA.tam / 2, -MARCA.tam / 2], [MARCA.tam / 2 - b, -MARCA.tam / 2], [-MARCA.tam / 2, MARCA.tam / 2 - b], [MARCA.tam / 2 - b, MARCA.tam / 2 - b]];
  const alvos = [];
  pos.forEach(([x, y], k) => {
    for (let j = 0; j < 4; j += 1) for (let i = 0; i < 4; i += 1) alvos.push({ x: MARCA.cx + x + (i + 0.5) * (b / 4), y: MARCA.cy + y + (j + 0.5) * (b / 4), k });
  });
  return alvos;
}
const ALVOS = alvosMarca();

// Quais 64 letras viajam até a marca (as outras encolhem e somem).
let VIAJANTES = null;
function viajantes() {
  if (VIAJANTES) return VIAJANTES;
  const lista = letras();
  const escolhidos = new Map();
  ALVOS.forEach((alvo, a) => {
    let idx = Math.floor(acaso(a, 913) * lista.length);
    while (escolhidos.has(idx)) idx = (idx + 1) % lista.length;
    escolhidos.set(idx, a);
  });
  VIAJANTES = escolhidos;
  return escolhidos;
}

function cenaTerminal(c, t) {
  c.fillStyle = PRETO;
  c.fillRect(0, 0, W, H);
  const pal = PALETAS.menta;
  const off = rolagem(t);
  const tPix = tb(CUE.pixelizar);
  const tTrava = tb(CUE.marcaTrava);

  if (t < tPix) {
    // Ainda é só o log rolando, cinza, rápido.
    const k0 = Math.max(0, Math.floor((off - TERM.y0) / TERM.lh) - 1);
    fonte(c, 400, TERM.tam, MONO);
    for (let k = k0; k < k0 + 33; k += 1) {
      const y = TERM.y0 + k * TERM.lh - off;
      if (y < -10 || y > H + 40) continue;
      const s = linhaLog(k);
      // Trechos da mesma cor desenhados de uma vez (mono: coluna * largura).
      let ini = 0;
      for (let col = 1; col <= s.length; col += 1) {
        if (col < s.length && corLetraLog(s, col) === corLetraLog(s, ini)) continue;
        c.fillStyle = corLetraLog(s, ini);
        c.fillText(s.slice(ini, col), TERM.x + ini * LARG_CARACTERE, y);
        ini = col;
      }
    }
  } else {
    // Cada letra vira um quadradinho no lugar exato onde estava.
    const lista = letras();
    const mapa = viajantes();
    const cores = [pal.primary, pal.secondary, pal.tertiary];
    const cm = coresMarca(pal);
    fonte(c, 400, TERM.tam, MONO);
    for (const l of lista) {
      if (t < l.tc) {
        c.fillStyle = l.cor0;
        c.fillText(l.ch, l.x, l.y);
        continue;
      }
      const cxq = l.x + LARG_CARACTERE / 2;
      const cyq = l.y - 10;
      const alvo = mapa.has(l.i) ? ALVOS[mapa.get(l.i)] : null;
      if (alvo) {
        // Escorre até a marca e chega exatamente na batida.
        const t0 = Math.max(l.tc + 0.06, tb(3.35));
        const p = meio(trecho(t, t0, tTrava));
        const x = lerp(cxq, alvo.x, p);
        const y = lerp(cyq, alvo.y, p);
        const lado = lerp(15, MARCA.tam * 0.44 / 4 - 2, p);
        c.fillStyle = p > 0 ? cm[alvo.k] : cores[l.cor];
        if (t < tTrava) c.fillRect(x - lado / 2, y - lado / 2, lado, lado);
        continue;
      }
      const tSome = tb(3.3) + acaso(l.i, 3) * 0.32;
      const q = trecho(t, tSome, tSome + 0.16);
      if (q >= 1) continue;
      const lado = 15 * (1 - saida(q));
      c.fillStyle = cores[l.cor];
      c.fillRect(cxq - lado / 2, cyq - lado / 2, lado, lado);
    }
  }

  // A tecla "/": entra pela direita, afunda com um clique seco e vira pixel.
  const tEntra = tb(CUE.teclaEntra);
  if (t >= tEntra) {
    const kx = lerp(2120, 1400, saida(trecho(t, tEntra, tb(CUE.teclaChega))));
    const ky = 330;
    const K = 360;
    if (t < tPix + 0.05) {
      const yf = tecla(c, kx, ky, K, K, { face: pal.primary, cor: borda(pal.primary), raio: 40, afundar: aperto(t, tb(CUE.teclaAfunda), 0.08), E: 22 });
      texto(c, "/", kx + K / 2, yf + K * 0.69, { peso: 500, tam: 210, fam: MONO, cor: pal.onPrimary, alinhar: "center" });
    } else {
      const G = 36;
      for (let gy = 0; gy < K; gy += G) {
        for (let gx = 0; gx < K; gx += G) {
          const q = trecho(t, tPix + 0.05 + acaso(gx, gy, 9) * 0.15, tPix + 0.25 + acaso(gx, gy, 9) * 0.15);
          if (q >= 1) continue;
          const lado = (G - 2) * (1 - saida(q));
          c.fillStyle = q > 0 ? pal.text : pal.primary;
          c.fillRect(kx + gx + (G - lado) / 2, ky + gy + (G - lado) / 2, lado, lado);
        }
      }
    }
  }

  if (t < tTrava) return;
  cenaMarca(c, t, pal, { giroBatidas: [CUE.marcaGira1], subtitulo: true });
}

function marcaCortina(c, t) {
  marca(c, MARCA.cx, MARCA.cy, MARCA.tam, giros(t, [CUE.marcaGira1]), coresMarca(PALETAS.menta));
}

// A marca e a palavra (também usada no fechamento).
function cenaMarca(c, t, pal, { giroBatidas, subtitulo, letrasT = CUE.letras, final = false, giroBase = 0 }) {
  const tTrava = final ? tb(CUE.marcaFinal) : tb(CUE.marcaTrava);
  // Travou: os blocos apertam e assentam.
  const assentar = 1 + 0.05 * (1 - saida(trecho(t, tTrava, tTrava + 0.12)));
  marca(c, MARCA.cx, MARCA.cy, MARCA.tam * assentar, giroBase + giros(t, giroBatidas), coresMarca(pal));
  // "Mosaic", letra por letra, cada uma descendo como tecla.
  const tam = 205;
  fonte(c, 700, tam);
  let x = 430;
  const base = MARCA.cy + MARCA.tam / 2 - 2;
  "Mosaic".split("").forEach((ch, k) => {
    const e = cair(t, tb(letrasT[k]), 60, 12);
    const w = c.measureText(ch).width;
    if (e) {
      fonte(c, 700, tam);
      if (e.borda) {
        c.fillStyle = "#2c2733";
        c.fillText(ch, x, base);
      }
      c.fillStyle = pal.text;
      c.fillText(ch, x, base + e.dy);
    }
    x += w - 4;
  });
  if (subtitulo) {
    const t0 = tb(CUE.subtitulo);
    if (t >= t0) {
      const n = Math.min(SUBTITULO.length, Math.floor((t - t0) / PASSO_DIGITAR) + 1);
      texto(c, SUBTITULO.slice(0, n), 152, 652, { tam: 54, fam: MONO, cor: rgba(pal.text, 0.82) });
      fonte(c, 400, 54, MONO);
      const cx = 152 + c.measureText(SUBTITULO.slice(0, n)).width + 8;
      if (Math.floor(t * 2.4) % 2 === 0) {
        c.fillStyle = pal.primary;
        c.fillRect(cx, 610, 27, 54);
      }
    }
  }
}

/* =====================================================================
   Cenas 4–8: o app (fundo de pixels + janela + legendas à esquerda)
   ===================================================================== */
const posJanelaX = (t) => lerp(700, 660, meio(trecho(t, tb(12), tb(20))));

function caminhoCursorDescobrir(t) {
  const p = meio(trecho(t, tb(CUE.cursorPasseia), tb(CUE.cursorPousa)));
  const alvo = alvoCartao(1, t);
  const P = [[300, 1010], [640, 600], [1140, 1080], [alvo.x, alvo.y]];
  const u = 1 - p;
  return {
    x: u * u * u * P[0][0] + 3 * u * u * p * P[1][0] + 3 * u * p * p * P[2][0] + p * p * p * P[3][0],
    y: u * u * u * P[0][1] + 3 * u * u * p * P[1][1] + 3 * u * p * p * P[2][1] + p * p * p * P[3][1],
  };
}
function alvoCartao(i, t) {
  const { x, y } = posCartao(i);
  return { x: posJanelaX(t) + (x + CART.w * 0.42) * JAN.U, y: JAN.y + (y + CART.h * 0.4) * JAN.U };
}
function alvoLinha(t) {
  return { x: posJanelaX(t) + 420 * JAN.U, y: JAN.y + (BUSCA.linhasY + LINHA_ALVO * BUSCA.alturaLinha + 27) * JAN.U };
}
function alvoInstalar(t) {
  return { x: posJanelaX(t) + (INSTALAR.x + INSTALAR.w / 2) * JAN.U, y: JAN.y + (INSTALAR.y + INSTALAR.h / 2) * JAN.U };
}

// O conteúdo da janela em cada momento das cenas 4–8.
function conteudoJanela(t, tela) {
  const pal = PALETAS.menta;
  if (tela === "inicio") {
    return (c) => {
      let lente = null;
      let hover = -1;
      if (t >= tb(CUE.cursorPasseia) && t < tb(CUE.barraEntra)) {
        const cur = caminhoCursorDescobrir(t);
        lente = { x: (cur.x - posJanelaX(t)) / JAN.U, y: (cur.y - JAN.y) / JAN.U, r: 190 / JAN.U };
        if (t >= tb(CUE.cursorPousa)) hover = 1;
      }
      telaInicio(c, t, pal, { cartoesT: CUE.cartoes.map(tb), hover, lente });
    };
  }
  if (tela === "busca") {
    const n = CUE.digita.filter((b) => t >= tb(b)).length;
    const hover = t >= tb(CUE.cliqueLinha) - 0.15 ? LINHA_ALVO : -1;
    return (c) => telaBusca(c, t, pal, { digitado: "firefox".slice(0, n), enterT: tb(CUE.enter), hover });
  }
  if (tela === "pacote") {
    const afundar = t >= tb(CUE.instalarAfunda) ? saida(trecho(t, tb(CUE.instalarAfunda), tb(CUE.instalarAfunda) + 0.06)) : 0;
    return (c) => telaPacote(c, t, pal, { avisoT: tb(CUE.aviso), pkgT: tb(CUE.pkgbuildAbre), linhasT: tb(CUE.pkgbuildLinhas), afundar });
  }
  const progresso = lerp(0.38, 0.86, trecho(t, tb(CUE.instalarAfunda) + 0.06, tb(44)));
  return (c) => telaFila(c, t, pal, { linhasT: tb(CUE.filaLinhas), progresso });
}

function telaNoTempo(t) {
  if (t < tb(CUE.barraAfunda) + 0.05) return "inicio";
  if (t < tb(CUE.cliqueLinha)) return "busca";
  if (t < tb(CUE.instalarAfunda) + 0.06) return "pacote";
  return "fila";
}

function cenaApp(c, t, { semLegendas = false } = {}) {
  const pal = PALETAS.menta;
  const jx = posJanelaX(t);
  let lente = null;
  const cur = t >= tb(CUE.cursorPasseia) && t < tb(CUE.barraEntra) ? caminhoCursorDescobrir(t) : null;
  if (cur) lente = { x: cur.x, y: cur.y, r: 200 };
  desenharCampo(c, t, 0, 0, W, H, pal, { passo: 24, lente, ox: (jx - 700) * -0.6, fundo: pal.view });

  // Janela (com a onda de pixels da busca para a página do pacote).
  const tela = telaNoTempo(t);
  const tClique = tb(CUE.cliqueLinha);
  const zoom = zoomInstalar(t);
  if (t >= tClique && t < tClique + 1.4) {
    const clique = alvoLinha(t);
    ondaRevela(c, t, tClique, {
      rx: jx, ry: JAN.y, rw: JAN.w, rh: JAN.h, ox: clique.x, oy: clique.y,
      passo: 30, espalhar: 0.95, encolher: 0.28, pal,
      velho: (cc) => janela(cc, jx, JAN.y, pal, conteudoJanela(tClique - 0.001, "busca")),
      novo: (cc) => janela(cc, jx, JAN.y, pal, conteudoJanela(t, "pacote")),
    });
  } else {
    janela(c, jx, JAN.y, pal, conteudoJanela(t, tela), zoom);
  }

  if (!semLegendas) legendasApp(c, t, pal);

  // Cursor: passeia no Descobrir e clica no resultado da busca.
  if (cur) cursor(c, cur.x, cur.y);
  const tc0 = tb(CUE.resultadosSai);
  if (t >= tc0 && t < tClique + 0.5) {
    const alvo = alvoLinha(t);
    const p = saida(trecho(t, tc0, tClique - 0.05));
    cursor(c, lerp(560, alvo.x, p), lerp(900, alvo.y, p), aperto(t, tClique, 0.02));
  }
}

function zoomInstalar(t) {
  const a = tb(CUE.closeComeca);
  const corte = tb(CUE.instalarAfunda) + 0.06;
  if (t >= corte) {
    // Na fila, a câmera chega devagar no terminal do build.
    const z = lerp(1, 1.08, meio(trecho(t, corte, tb(CUE.buildSai))));
    const jx = posJanelaX(t);
    const ax = jx + (376 + (AW - 396) / 2) * JAN.U;
    const ay = JAN.y + (64 + (AH - 84) / 2) * JAN.U;
    return { z, ax, ay, px: ax, py: ay };
  }
  if (t < a) return null;
  const k = alvoInstalar(t);
  const e = meio(trecho(t, a, tb(CUE.closeFim)));
  return { z: lerp(1, 2.1, e), ax: k.x, ay: k.y, px: lerp(k.x, 1240, e), py: lerp(k.y, 470, e) };
}

function legendasApp(c, t, pal) {
  const X = 110;
  // Cena 4.
  if (t >= tb(CUE.descubra) - QUEDA && t < tb(CUE.descubraSai) + 0.4) {
    legenda(c, t, { linhas: ["Descubra."], x: X, y: 560, tam: 118, entrelinha: 120, tempos: [tb(CUE.descubra)], cor: pal.text, saiT: tb(CUE.descubraSai) });
  }
  // Cena 5: a barra, as letras e o Enter como teclas de verdade.
  if (t >= tb(CUE.barraEntra) - QUEDA && t < tb(CUE.teclasSaem) + 0.4) teclasBusca(c, t, pal);
  if (t >= tb(CUE.teclasSaem) + 0.02 && t < tb(CUE.resultadosSai) + 0.4) contadorBusca(c, t, pal);
  // Cena 7.
  if (t >= tb(CUE.aviso) - QUEDA && t < tb(CUE.reviseSai) + 0.4) {
    legenda(c, t, { linhas: ["Revise", "antes de", "instalar."], x: X, y: 430, tam: 104, entrelinha: 112, tempos: CUE.reviseTexto.map(tb), cor: pal.text, saiT: tb(CUE.reviseSai) });
  }
  // Cena 8.
  if (t >= tb(CUE.buildTexto[0]) - QUEDA && t < tb(CUE.buildSai) + 0.4) {
    legenda(c, t, { linhas: ["O build,", "ao vivo."], x: X, y: 500, tam: 112, entrelinha: 120, tempos: CUE.buildTexto.map(tb), cor: pal.text, saiT: tb(CUE.buildSai) });
  }
}

function teclasBusca(c, t, pal) {
  const sai = tb(CUE.teclasSaem);
  const desenhar = (cc, tt) => {
    // "/" grande.
    const e = cair(tt, tb(CUE.barraEntra), 60, 0);
    if (e) {
      const yf = tecla(cc, 110, 290 + e.dy, 190, 190, { face: "#2b2931", cor: "#121016", raio: 24, afundar: aperto(tt, tb(CUE.barraAfunda), 0.06), E: 12 });
      texto(cc, "/", 205, yf + 132, { peso: 500, tam: 112, fam: MONO, cor: pal.text, alinhar: "center" });
    }
    // "firefox" digitado grande: cada letra cai como tecla, no tempo do clique.
    fonte(cc, 600, 124, MONO);
    const lc = cc.measureText("f").width;
    let n = 0;
    "firefox".split("").forEach((ch, k) => {
      const ek = cair(tt, tb(CUE.digita[k]), 34, 7);
      if (!ek) return;
      n = k + 1;
      const x = 110 + k * lc;
      if (ek.borda) texto(cc, ch, x, 640, { peso: 600, tam: 124, fam: MONO, cor: "#2c2733" });
      texto(cc, ch, x, 640 + ek.dy, { peso: 600, tam: 124, fam: MONO, cor: pal.text });
    });
    if (tt >= tb(CUE.barraAfunda) && tt < tb(CUE.enter) && (n < 7 || Math.floor(tt * 2.4) % 2 === 0)) {
      cc.fillStyle = pal.primary;
      cc.fillRect(116 + n * lc, 548, 10, 108);
    }
    const ee = cair(tt, tb(CUE.enterEntra), 30, 0);
    if (ee) {
      const yf = tecla(cc, 110, 690 + ee.dy, 262, 84, { face: pal.primary, cor: borda(pal.primary), raio: 12, afundar: aperto(tt, tb(CUE.enter), 0.06), E: 9 });
      texto(cc, "↵ Enter", 241, yf + 56, { peso: 600, tam: 38, fam: MONO, cor: pal.onPrimary, alinhar: "center" });
    }
  };
  if (t >= sai) {
    pixelSaida(c, t, sai, (cc) => desenhar(cc, sai - 0.001), { x0: 100, y0: 280, x1: 700, y1: 800 }, pal.text, 14);
    return;
  }
  desenhar(c, t);
}

function contadorBusca(c, t, pal) {
  const t0 = tb(CUE.enter);
  const valor = contador(t - t0, tb(CUE.contadorFim) - t0);
  const sai = tb(CUE.resultadosSai);
  const desenhar = (cc, tt, v) => {
    texto(cc, String(v), 110, 520, { peso: 700, tam: 230, cor: pal.text });
    const e = cair(tt, tb(CUE.resultadosTexto), 40, 8);
    if (e) {
      fonte(cc, 700, 92);
      if (e.borda) texto(cc, "resultados.", 110, 640, { peso: 700, tam: 92, cor: "#2c2733" });
      texto(cc, "resultados.", 110, 640 + e.dy, { peso: 700, tam: 92, cor: pal.text });
    }
    const em = cair(tt, tb(CUE.msTexto), 30, 0);
    if (em) texto(cc, "busca local em ~7 ms", 114, 734 + em.dy, { peso: 500, tam: 48, fam: MONO, cor: pal.primary });
  };
  if (t >= sai) {
    pixelSaida(c, t, sai, (cc) => desenhar(cc, sai - 0.001, 745), { x0: 100, y0: 330, x1: 760, y1: 760 }, pal.text, 14);
    return;
  }
  desenhar(c, t, valor);
}

/* =====================================================================
   Cena 9: as cores do wallpaper
   ===================================================================== */
function wallpaper(c, pal, tipo) {
  c.fillStyle = pal.win;
  c.fillRect(0, 0, W, H);
  if (tipo === "laranja") {
    // Pôr do sol com faixas, chapado.
    circulo(c, 545, 300, 205, pal.primary);
    c.fillStyle = pal.win;
    for (let k = 0; k < 6; k += 1) c.fillRect(330, 330 + k * 30, 440, 4 + k * 3);
    poligono(c, pal.secCont, [[0, 760], [260, 700], [520, 740], [900, 690], [1300, 760], [1920, 700], [1920, 1080], [0, 1080]]);
    poligono(c, misturar(pal.terCont, "#000000", 0.25), [[0, 860], [380, 820], [760, 880], [1200, 830], [1920, 880], [1920, 1080], [0, 1080]]);
    poligono(c, "#0d0906", [[0, 960], [500, 930], [1000, 975], [1920, 940], [1920, 1080], [0, 1080]]);
  } else if (tipo === "azul") {
    // Mar à noite: lua e ondas em faixas.
    circulo(c, 545, 290, 160, pal.light);
    circulo(c, 610, 255, 138, pal.win);
    [[720, pal.terCont], [820, pal.secCont], [920, misturar(pal.secCont, "#000000", 0.45)], [1010, "#07090c"]].forEach(([y0, cor], k) => {
      const pts = [];
      for (let x = 0; x <= W; x += 40) pts.push([x, y0 + Math.sin(x / (140 + k * 30) + k) * (18 - k * 3)]);
      pts.push([W, H], [0, H]);
      poligono(c, cor, pts);
    });
  } else {
    // Montanhas e lua.
    circulo(c, 545, 290, 140, pal.tertiary);
    poligono(c, pal.terCont, [[0, 820], [240, 560], [460, 760], [700, 520], [1000, 800], [1300, 600], [1920, 840], [1920, 1080], [0, 1080]]);
    poligono(c, misturar(pal.secCont, "#000000", 0.2), [[0, 900], [320, 720], [620, 880], [980, 700], [1400, 900], [1920, 760], [1920, 1080], [0, 1080]]);
    poligono(c, "#0b0a10", [[0, 1000], [420, 900], [880, 990], [1400, 920], [1920, 990], [1920, 1080], [0, 1080]]);
  }
}
function poligono(c, cor, pts) {
  c.fillStyle = cor;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

const ESTADOS_WALL = [
  { pal: "laranja", troca: CUE.troca1, origem: () => ({ x: 195, y: 335 }) },
  { pal: "azul", troca: CUE.troca2, origem: () => ({ x: W, y: 540 }) },
  { pal: "menta", troca: CUE.troca3, origem: () => ({ x: 1000, y: H }) },
];
const MARCA_WALL = { cx: 195, cy: 335, tam: 170 };

function cenaWallpaper(c, t, idx) {
  const est = ESTADOS_WALL[idx];
  const pal = PALETAS[est.pal];
  wallpaper(c, pal, est.pal);
  janela(c, 660, JAN.y, pal, (cc) => telaInicio(cc, t, pal, {}));
  marca(c, MARCA_WALL.cx, MARCA_WALL.cy, MARCA_WALL.tam, giros(t, [CUE.troca1, CUE.troca2, CUE.troca3]), coresMarca(pal));
  legenda(c, t, {
    linhas: ["Com as cores", "do seu", "wallpaper."], x: 110, y: 660, tam: 76, entrelinha: 86,
    tempos: [tb(CUE.coresTexto), tb(CUE.coresTexto) + 0.125, tb(CUE.coresTexto) + 0.25, tb(CUE.wallpaperTexto), tb(CUE.wallpaperTexto) + 0.125, tb(CUE.wallpaperTexto) + 0.25],
    cor: pal.text, saiT: tb(CUE.coresSai),
  });
}

// O fim da cena 8 com a marca já entrando à esquerda (antes da 1ª troca).
function cenaAntesDaTroca(c, t) {
  cenaApp(c, t);
  const e = cair(t, tb(CUE.marcaVolta), 50, 10);
  if (e) {
    const pal = PALETAS.menta;
    if (e.borda) marca(c, MARCA_WALL.cx, MARCA_WALL.cy, MARCA_WALL.tam, 0, coresMarca(pal).map(borda));
    marca(c, MARCA_WALL.cx, MARCA_WALL.cy + e.dy, MARCA_WALL.tam, giros(t, [CUE.troca1]), coresMarca(pal));
  }
}

/* =====================================================================
   Cena 10: tudo vira pixel e volta a ser a marca
   ===================================================================== */
const PASSO_FIM = 24;
// A parede desmonta numa onda que corre até a marca: as células longe dela
// encolhem primeiro e as da marca são as últimas, quando viram os blocos.
const DIST_MAX_FIM = Math.hypot(W - MARCA.cx, H - MARCA.cy);
const VARREDURA_FIM = 1.05;
const inicioEncolher = (x, y, i, j, tVira) => tVira + (1 - Math.hypot(x - MARCA.cx, y - MARCA.cy) / DIST_MAX_FIM) * VARREDURA_FIM + acaso(i, j, 3) * 0.05;

function cenaFim(c, t) {
  const pal = PALETAS.menta;
  const tVira = tb(CUE.desfazVira);
  const tTrava = tb(CUE.marcaFinal);
  const tf = tempoCampo(t);
  c.fillStyle = pal.view;
  c.fillRect(0, 0, W, H);
  const cores = [pal.primary, pal.secondary, pal.tertiary];
  // Cinco níveis de opacidade por cor: da parede (1) ao campo (0,42).
  const NIVEIS = 5;
  const porCor = cores.map(() => Array.from({ length: NIVEIS }, () => new Path2D()));
  const neutro = new Path2D();
  for (let j = 0; j <= H / PASSO_FIM; j += 1) {
    for (let i = 0; i <= W / PASSO_FIM; i += 1) {
      const x = i * PASSO_FIM + PASSO_FIM / 2;
      const y = j * PASSO_FIM + PASSO_FIM / 2;
      const [k, f] = corDoCampo(x / 1.6, y / 1.6, tf);
      const alvo = ladoDoCampo(f, 0, PASSO_FIM / 15);
      const t0 = inicioEncolher(x, y, i, j, tVira);
      const qi = saida(trecho(t, t0, t0 + 0.3));
      const lado = lerp(PASSO_FIM + 0.5, alvo.lado, qi);
      if (alvo.neutro && qi > 0.85) neutro.rect(x - lado / 2, y - lado / 2, lado, lado);
      else porCor[k][Math.min(NIVEIS - 1, Math.floor(qi * NIVEIS))].rect(x - lado / 2, y - lado / 2, lado, lado);
    }
  }
  c.fillStyle = rgba(pal.text, 0.12);
  c.fill(neutro);
  for (let k = 0; k < 3; k += 1) {
    for (let n = 0; n < NIVEIS; n += 1) {
      c.fillStyle = rgba(cores[k], lerp(1, 0.42, (n + 0.5) / NIVEIS));
      c.fill(porCor[k][n]);
    }
  }
  // Os 64 quadradinhos da marca nascem quando a onda chega neles, já nas
  // cores da marca girada um quarto de volta para trás (giroBase -1).
  if (t < tTrava) {
    const base = coresMarca(pal);
    const cm = [base[1], base[3], base[0], base[2]];
    const ladoFinal = (MARCA.tam * 0.44) / 4 - 2;
    ALVOS.forEach((a, n) => {
      const t0 = inicioEncolher(a.x, a.y, n, 0, tVira) + 0.08;
      const p = saida(trecho(t, t0, Math.min(t0 + 0.24, tTrava)));
      if (p <= 0) return;
      const lado = ladoFinal * p;
      c.fillStyle = cm[a.k];
      c.fillRect(a.x - lado / 2, a.y - lado / 2, lado, lado);
    });
  }
  if (t < tTrava) return;
  const letrasFim = [0, 1, 2, 3, 4, 5].map((k) => CUE.palavraFinal + 0.25 + k * 0.125);
  // Trava um quarto de volta atrás: o último giro deixa a marca na ordem
  // oficial (menta, rosa / azul, clara) no quadro congelado.
  cenaMarca(c, t, pal, { giroBatidas: [CUE.marcaGiraFinal], subtitulo: false, letrasT: letrasFim, final: true, giroBase: -1 });
  const e = cair(t, tb(CUE.linhaFinal), 26, 0);
  if (e) texto(c, "Arch Linux · AUR · core · extra", 152, 652 + e.dy, { tam: 50, fam: MONO, cor: rgba(pal.text, 0.82) });
  const t0 = tb(CUE.link);
  if (t >= t0) {
    const n = Math.min(LINK.length, Math.floor(((t - t0) / (tb(CUE.linkFim) - t0)) * LINK.length) + 1);
    texto(c, LINK.slice(0, n), 152, 752, { peso: 600, tam: 60, fam: MONO, cor: pal.primary });
    if (n < LINK.length) {
      fonte(c, 600, 60, MONO);
      c.fillStyle = pal.primary;
      c.fillRect(152 + c.measureText(LINK.slice(0, n)).width + 8, 706, 30, 60);
    }
  }
}

/* =====================================================================
   O quadro
   ===================================================================== */
export function seek(tReal) {
  const t = Math.min(tReal, tb(CUE.congela));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;

  const tCobre = tb(CUE.cortinaCobre);
  const tAbre = tb(CUE.cortinaAbre);
  const tTroca1 = tb(CUE.troca1);
  const tDesfaz = tb(CUE.desfaz);

  if (t < tCobre) {
    cenaTerminal(ctx, t);
  } else if (t < tAbre) {
    // Cena 3a: a cortina cobre a marca, saindo dela.
    cenaTerminal(ctx, t);
    ondaCobre(ctx, t, tCobre, { rx: 0, ry: 0, rw: W, rh: H, ox: MARCA.cx, oy: MARCA.cy, passo: 32, espalhar: 0.45, crescer: 0.13, cheia: PALETAS.menta.win, pal: PALETAS.menta });
    // A marca fica por cima da cortina: é dela que a próxima onda sai.
    marcaCortina(ctx, t);
  } else if (t < tTroca1 - 0.25) {
    if (t < tb(CUE.janelaInteira)) {
      // Cena 3b: a cortina se desfaz em onda e revela o app.
      ondaRevela(ctx, t, tAbre, {
        rx: 0, ry: 0, rw: W, rh: H, ox: MARCA.cx + MARCA.tam / 2, oy: MARCA.cy + MARCA.tam / 2,
        passo: 32, espalhar: 0.96, encolher: 0.24, pal: PALETAS.menta,
        velho: (c) => {
          c.fillStyle = PALETAS.menta.win;
          c.fillRect(0, 0, W, H);
          marcaCortina(c, t);
        },
        novo: (c) => cenaApp(c, t),
      });
    } else {
      cenaApp(ctx, t);
    }
  } else if (t < tDesfaz) {
    // Cena 9: três trocas de wallpaper, cada onda de um lado.
    if (t < tTroca1) {
      cenaAntesDaTroca(ctx, t);
    } else {
      let idx = 0;
      for (let k = 0; k < ESTADOS_WALL.length; k += 1) if (t >= tb(ESTADOS_WALL[k].troca)) idx = k;
      const est = ESTADOS_WALL[idx];
      const t0 = tb(est.troca);
      const dur = idx === 0 ? 1.2 : 0.8;
      if (t < t0 + dur) {
        const o = est.origem();
        ondaRevela(ctx, t, t0, {
          rx: 0, ry: 0, rw: W, rh: H, ox: o.x, oy: o.y, passo: 32,
          espalhar: idx === 0 ? 0.9 : 0.55, encolher: 0.22, pal: PALETAS[est.pal],
          velho: (c) => (idx === 0 ? cenaAntesDaTroca(c, t0 - 0.001) : cenaWallpaper(c, t, idx - 1)),
          novo: (c) => cenaWallpaper(c, t, idx),
        });
      } else {
        cenaWallpaper(ctx, t, idx);
      }
    }
  } else if (t < tb(CUE.desfazVira)) {
    // Cena 10a: a interface inteira vira uma parede de pixels.
    cenaWallpaper(ctx, t, 2);
    ondaCobre(ctx, t, tDesfaz, { rx: 0, ry: 0, rw: W, rh: H, ox: 1230, oy: 540, passo: PASSO_FIM, espalhar: 0.42, crescer: 0.1, cheia: null, pal: PALETAS.menta, alinharGlobal: true });
  } else {
    cenaFim(ctx, t);
  }
}
