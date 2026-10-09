// Trilha e efeitos do filme, sintetizados aqui (nenhum sample).
// Gera build/trilha-bruta.wav (float 32) e build/beats.json com a grade de
// batidas MEDIDA na própria trilha (detecção de ataques + ajuste de grade).
import fs from "node:fs";
import { BPM, CARTOES, CUE, DURACAO, LINK, PASSO_DIGITAR, SUBTITULO, TOTAL_BATIDAS, tomDe } from "./cues.js";

const SR = 48000;
const N = SR * DURACAO;
const BATIDA = 60 / BPM;
const tb = (b) => b * BATIDA;

const mixL = new Float32Array(N);
const mixR = new Float32Array(N);
const revL = new Float32Array(N); // envio para o reverb
const revR = new Float32Array(N);
const perc = new Float32Array(N); // percussão no tempo, só para medir a grade

/* ---------- utilidades ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ruidoSemente = mulberry32(0x5eed);
const RUIDO = new Float32Array(SR * 2).map(() => ruidoSemente() * 2 - 1);
const ruido = (i) => RUIDO[i % RUIDO.length];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Só a percussão do arranjo entra na medição da grade; os efeitos que
// acompanham a imagem (fora da batida) ficam de fora.
let MEDIR = true;
function somar(buf, t0, gain = 1, pan = 0, rev = 0, noTempo = false) {
  const i0 = Math.round(t0 * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let k = 0; k < buf.length; k += 1) {
    const i = i0 + k;
    if (i < 0 || i >= N) continue;
    mixL[i] += buf[k] * gl;
    mixR[i] += buf[k] * gr;
    if (rev) { revL[i] += buf[k] * gl * rev; revR[i] += buf[k] * gr * rev; }
    if (noTempo && MEDIR) perc[i] += buf[k] * gain;
  }
}

// Biquad (RBJ). tipo: lp, hp, bp
function biquad(buf, tipo, freq, q = 0.707) {
  const w = (2 * Math.PI * freq) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (tipo === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (tipo === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; }
  a0 = 1 + a; a1 = -2 * c; a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y;
  }
  return buf;
}

function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function quadrada(fase, dt) {
  let v = fase < 0.5 ? 1 : -1;
  v += polyblep(fase, dt);
  v -= polyblep((fase + 0.5) % 1, dt);
  return v;
}
function serra(fase, dt) {
  return 2 * fase - 1 - polyblep(fase, dt);
}

/* ---------- instrumentos ---------- */
// Tique-taque do terminal.
function tique(t, agudo, gain = 0.18) {
  const n = Math.round(0.03 * SR), b = new Float32Array(n), f = agudo ? 2100 : 1600;
  for (let i = 0; i < n; i += 1) b[i] = Math.sin((2 * Math.PI * f * i) / SR) * Math.exp(-i / (0.006 * SR));
  somar(b, t, gain, agudo ? 0.25 : -0.25, 0, true);
}

// Clique de tecla mecânica: estalo, fundo da tecla e a volta.
function tecla(t, forca = 1, pan = 0) {
  const n = Math.round(0.14 * SR);
  const estalo = new Float32Array(n);
  for (let i = 0; i < n; i += 1) estalo[i] = ruido(i * 7 + Math.round(t * 1000)) * Math.exp(-i / (0.0025 * SR));
  biquad(estalo, "bp", 4200, 1.1);
  const fundo = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = 60 + 40 * Math.exp(-i / (0.004 * SR));
    fase += (2 * Math.PI * f) / SR;
    fundo[i] = Math.sin(fase) * Math.exp(-i / (0.012 * SR));
  }
  const volta = new Float32Array(Math.round(0.02 * SR));
  for (let i = 0; i < volta.length; i += 1) volta[i] = Math.sin((2 * Math.PI * 2000 * i) / SR) * Math.exp(-i / (0.002 * SR));
  somar(estalo, t, 0.55 * forca, pan, 0.05, true);
  somar(fundo, t, 0.5 * forca, pan, 0, true);
  somar(volta, t + 0.07, 0.12 * forca, pan);
  if (forca > 1.2) {
    const sub = new Float32Array(Math.round(0.35 * SR));
    for (let i = 0; i < sub.length; i += 1) sub[i] = Math.sin((2 * Math.PI * 45 * i) / SR) * Math.exp(-i / (0.09 * SR));
    somar(sub, t, 0.6, 0, 0, true);
  }
}

function kick(t, gain = 0.9) {
  const n = Math.round(0.4 * SR), b = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = 46 + 110 * Math.exp(-i / (0.025 * SR));
    fase += (2 * Math.PI * f) / SR;
    b[i] = Math.tanh(1.6 * Math.sin(fase)) * Math.exp(-i / (0.11 * SR));
  }
  for (let i = 0; i < 150; i += 1) b[i] += ruido(i + 99) * 0.3 * (1 - i / 150);
  somar(b, t, gain, 0, 0, true);
}

function caixa(t, gain = 0.45) {
  const n = Math.round(0.25 * SR), r = new Float32Array(n), corpo = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    r[i] = ruido(i * 3 + 11) * Math.exp(-i / (0.05 * SR));
    corpo[i] = Math.sin((2 * Math.PI * 190 * i) / SR) * Math.exp(-i / (0.03 * SR));
  }
  biquad(r, "hp", 1500); biquad(r, "lp", 9000);
  somar(r, t, gain, 0.05, 0.25, true);
  somar(corpo, t, gain * 0.7, 0, 0.1);
}

function chimbal(t, gain = 0.16, pan = 0.3) {
  const n = Math.round(0.05 * SR), b = new Float32Array(n);
  for (let i = 0; i < n; i += 1) b[i] = ruido(i * 5 + Math.round(t * 977)) * Math.exp(-i / (0.009 * SR));
  biquad(b, "hp", 7500);
  somar(b, t, gain, pan);
}

function bipe(t, nota, gain = 0.07, pan = 0, dur = 0.05) {
  const n = Math.round(dur * SR), b = new Float32Array(n), f = midi(nota);
  for (let i = 0; i < n; i += 1) {
    const fase = ((f * i) / SR) % 1;
    b[i] = (0.6 * Math.sin(2 * Math.PI * fase) + 0.4 * (fase < 0.5 ? 1 : -1)) * Math.exp(-i / (0.012 * SR));
  }
  biquad(b, "lp", 7000);
  somar(b, t, gain, pan, 0.25);
}

// Nota de arpejo em onda quadrada (timbre de videogame antigo).
function arpejo(t, nota, gain = 0.1, pan = 0) {
  const n = Math.round(0.24 * SR), b = new Float32Array(n), f = midi(nota), dt = f / SR;
  let fase = 0;
  for (let i = 0; i < n; i += 1) {
    b[i] = quadrada(fase, dt) * Math.exp(-i / (0.07 * SR));
    fase = (fase + dt) % 1;
  }
  biquad(b, "lp", 3200);
  somar(b, t, gain, pan, 0.3);
}

// O acorde de assinatura: uma nota por bloco da marca.
function acorde(t, notas, dur, gain = 0.2) {
  const n = Math.round((dur + 0.6) * SR);
  notas.forEach((nota, k) => {
    const b = new Float32Array(n), f = midi(nota), dt = f / SR;
    let fase = 0;
    for (let i = 0; i < n; i += 1) {
      const env = Math.min(1, i / (0.004 * SR)) * Math.exp(-i / ((dur * 0.55) * SR));
      b[i] = (0.65 * Math.sin(2 * Math.PI * fase) + 0.35 * quadrada(fase, dt) * 0.5) * env;
      fase = (fase + dt) % 1;
    }
    biquad(b, "lp", 4500);
    somar(b, t + k * 0.008, gain, (k / (notas.length - 1)) * 1.2 - 0.6, 0.45);
  });
}

// Pad: serras desafinadas, filtradas, com entrada e saída suaves.
function pad(t0, t1, notas, gain = 0.05) {
  const n = Math.round((t1 - t0 + 0.6) * SR);
  notas.forEach((nota, k) => {
    for (const desaf of [-0.08, 0.08]) {
      const b = new Float32Array(n), f = midi(nota + desaf), dt = f / SR;
      let fase = (k * 0.13) % 1;
      for (let i = 0; i < n; i += 1) {
        const tt = i / SR;
        const env = Math.min(1, tt / 0.25) * (tt > t1 - t0 ? Math.exp(-(tt - (t1 - t0)) / 0.15) : 1);
        b[i] = serra(fase, dt) * env;
        fase = (fase + dt) % 1;
      }
      biquad(b, "lp", 1400);
      somar(b, t0, gain, desaf < 0 ? -0.4 : 0.4, 0.35);
    }
  });
}

function baixo(t0, t1, nota, gain = 0.32) {
  const n = Math.round((t1 - t0) * SR), b = new Float32Array(n), f = midi(nota);
  for (let i = 0; i < n; i += 1) {
    const tt = i / SR;
    const env = Math.min(1, tt / 0.01) * Math.min(1, (t1 - t0 - tt) / 0.02);
    b[i] = Math.tanh(1.5 * Math.sin(2 * Math.PI * f * tt)) * env;
  }
  somar(b, t0, gain, 0);
}

// Chiado subindo: ruído com o filtro abrindo.
function riser(t0, t1, gain = 0.22) {
  const n = Math.round((t1 - t0) * SR), b = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    const p = i / n;
    const corte = 300 * Math.pow(9000 / 300, p);
    const a = 1 - Math.exp((-2 * Math.PI * corte) / SR);
    y += a * (ruido(i * 13 + 5) - y);
    b[i] = y * Math.pow(p, 1.6);
  }
  somar(b, t0, gain, 0, 0.3);
}

function impacto(t, gain = 0.7) {
  const n = Math.round(0.9 * SR), boom = new Float32Array(n), r = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = 40 + 50 * Math.exp(-i / (0.05 * SR));
    fase += (2 * Math.PI * f) / SR;
    boom[i] = Math.sin(fase) * Math.exp(-i / (0.28 * SR));
    r[i] = ruido(i * 17 + 3) * Math.exp(-i / (0.07 * SR));
  }
  biquad(r, "lp", 1800);
  somar(boom, t, gain, 0, 0.2, true);
  somar(r, t, gain * 0.5, 0, 0.4);
}

// Varredura curta de cada onda de pixels.
function varredura(t, dur = 0.7, gain = 0.16, pan = 0) {
  const n = Math.round(dur * SR), b = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i += 1) {
    const p = i / n;
    const corte = 6000 * Math.pow(400 / 6000, p);
    const a = 1 - Math.exp((-2 * Math.PI * corte) / SR);
    y += a * (ruido(i * 19 + 7) - y);
    b[i] = y * Math.sin(Math.PI * Math.min(1, p * 1.4)) ;
  }
  somar(b, t, gain, pan, 0.3);
}

/* ---------- arranjo ---------- */
const PENTA = [0, 2, 4, 7, 9];
const tom = (b) => (b >= CUE.troca3 ? 6 : b >= CUE.troca2 ? 4 : b >= CUE.troca1 ? 2 : 0);
const C4 = 60;
// Cores da marca -> notas: verde Dó, rosa Mi, azul Sol, claro Si.
const NOTA_COR = [0, 4, 7, 11];

// Cena 1: tique-taque, a tecla e a chuva de bipes.
for (let b = 0; b < 4; b += 1) tique(tb(b), b % 2 === 0);
tecla(tb(CUE.teclaAfunda), 1.1, 0.3);
for (let k = 0; k < 48; k += 1) {
  const t = tb(CUE.pixelizar) + (k / 48) * (tb(CUE.pixelizarFim) - tb(CUE.pixelizar));
  const nota = 84 + PENTA[k % 5] + 12 * Math.floor((k % 10) / 5);
  bipe(t, nota, 0.05, (k / 47) * 1.6 - 0.8, 0.04);
}

// Cena 2: acorde de assinatura, o grave entra, as letras como teclas.
acorde(tb(CUE.marcaTrava), [C4, C4 + 4, C4 + 7, C4 + 11], 1.6, 0.17);
baixo(tb(CUE.marcaTrava), tb(CUE.marcaTrava) + 0.25, 36, 0.4);
CUE.letras.forEach((b, k) => tecla(tb(b), 0.6, -0.3 + k * 0.12));
for (let k = 0; k < SUBTITULO.length; k += 1) if (SUBTITULO[k] !== " ") tecla(tb(CUE.subtitulo) + k * PASSO_DIGITAR, 0.16, 0.4);
bipe(tb(CUE.marcaGira1), 79, 0.06, 0, 0.08);

// Cena 3: a cortina cobre (glitter subindo), chiado e impacto na janela.
for (let k = 0; k < 24; k += 1) bipe(tb(CUE.cortinaCobre) + k * 0.025, 72 + PENTA[k % 5] + 12 * Math.floor(k / 10), 0.035, Math.sin(k) * 0.6, 0.04);
riser(tb(CUE.cortinaAbre) - 0.3, tb(CUE.janelaInteira), 0.26);
impacto(tb(CUE.janelaInteira), 0.75);

// Grade rítmica por compasso (compasso k começa na batida 4k).
const ACORDES = {
  3: [57, 60, 64, 67], // Am7
  4: [48, 52, 55, 59], // Cmaj7
  5: [57, 60, 64, 67],
  6: [53, 57, 60, 64], // Fmaj7
  7: [55, 59, 62, 64], // G6
  8: [48, 52, 55, 59],
  10: [57, 60, 64, 67],
  11: [53, 57, 60, 64],
  12: [48, 52, 55, 59],
  13: [48, 52, 55, 59],
  14: [53, 57, 60, 64],
};
for (let comp = 1; comp < 15; comp += 1) {
  const b0 = comp * 4;
  const acordeComp = ACORDES[comp];
  const sobe = (b) => tom(b);

  // Pad (o compasso 13 é dividido em duas trocas de tom).
  if (acordeComp && comp !== 13) pad(tb(b0), tb(b0 + 4), acordeComp.map((n) => n + 12 + sobe(b0)), comp === 9 ? 0.03 : 0.045);
  if (comp === 13) {
    pad(tb(b0), tb(b0 + 2), acordeComp.map((n) => n + 12 + 4), 0.045);
    pad(tb(b0 + 2), tb(b0 + 4), acordeComp.map((n) => n + 12 + 6), 0.05);
  }
  // A lente sobe uma oitava no pad (cena 4, segunda metade).
  if (comp === 4) pad(tb(CUE.cursorPasseia), tb(CUE.cursorPousa + 0.8), [72, 76, 79], 0.03);

  const groove = (comp >= 3 && comp <= 8) || (comp >= 10 && comp <= 13);
  for (let k = 0; k < 4; k += 1) {
    const b = b0 + k;
    if (comp === 3) continue; // cena 3: só o chiado subindo
    if (groove) {
      kick(tb(b), 0.85);
      if (acordeComp) {
        const raiz = acordeComp[0] - 12 + sobe(b);
        baixo(tb(b) + 0.06, tb(b) + 0.22, raiz, 0.28);
        baixo(tb(b) + 0.31, tb(b) + 0.47, raiz + 12, 0.18);
      }
    }
    if (comp === 9 && k % 2 === 0) kick(tb(b), 0.7); // respiro: meio tempo
    if (comp === 2 && k >= 1) kick(tb(b), 0.6);
  }
  // Chimbal: colcheias na fila, semicolcheias nas trocas de wallpaper.
  if (comp === 10 || comp === 11) for (let k = 0; k < 8; k += 1) chimbal(tb(b0) + k * 0.25 + 0.125, 0.14);
  if (comp === 12 || comp === 13) for (let k = 0; k < 16; k += 1) chimbal(tb(b0) + k * 0.125, k % 2 ? 0.1 : 0.15);
  if (comp === 12 || comp === 13) { caixa(tb(b0 + 1)); caixa(tb(b0 + 3)); }
}

// Cena 4: cartões entrando com as notas das suas cores, e o arpejo.
const TOM_CARTOES = CARTOES.map(tomDe); // mesmos tons dos ícones no filme
CUE.cartoes.forEach((b, k) => arpejo(tb(b), 72 + NOTA_COR[TOM_CARTOES[k]], 0.11, -0.5 + k * 0.2));
for (let k = 0; k < 20; k += 1) {
  const b = 15 + k * 0.25;
  if (b >= 20) break;
  arpejo(tb(b), 72 + NOTA_COR[k % 4] + (k % 8 >= 4 ? 12 : 0), 0.07, Math.sin(k) * 0.5);
}

// Cena 5: a barra, as letras digitadas, o Enter e o contador acelerando.
tecla(tb(CUE.barraAfunda), 1.1, -0.2);
CUE.digita.forEach((b, k) => tecla(tb(b), 0.75, -0.4 + k * 0.12));
caixa(tb(CUE.enter), 0.55);
tecla(tb(CUE.enter), 1, 0);
const durContador = tb(CUE.contadorFim) - tb(CUE.enter);
for (let c = 25; c <= 745; c += 25) {
  const t = tb(CUE.enter) + durContador * Math.cbrt(c / 745);
  bipe(t, 96, 0.035, 0.3, 0.025);
}
bipe(tb(CUE.resultadosTexto), 91, 0.08, 0, 0.12);

// Cena 6: chiado até o clique, impacto no clique, a onda.
riser(tb(CUE.cliqueLinha) - 0.5, tb(CUE.cliqueLinha), 0.2);
tecla(tb(CUE.cliqueLinha), 0.9, 0.2);
impacto(tb(CUE.cliqueLinha), 0.55);
varredura(tb(CUE.cliqueLinha) + 0.05, 1.0, 0.12, 0.2);

// Cena 7: o aviso afunda; um tom grave sustenta o respiro.
tecla(tb(CUE.aviso), 0.9, 0);
baixo(tb(CUE.aviso), tb(CUE.aviso + 4) - 0.05, 36, 0.22);
for (let k = 0; k < 12; k += 1) tecla(tb(CUE.pkgbuildLinhas) + k * 0.125, 0.14, 0.3);

// Cena 8: o clique mais forte, com o grave por baixo.
riser(tb(CUE.closeComeca), tb(CUE.instalarAfunda), 0.12);
tecla(tb(CUE.instalarAfunda), 1.6, 0);
impacto(tb(CUE.instalarAfunda), 0.5);

// Cena 9: uma varredura e um bipe por troca de wallpaper.
[CUE.troca1, CUE.troca2, CUE.troca3].forEach((b, k) => {
  varredura(tb(b), 0.8, 0.18, [-0.6, 0.6, 0][k]);
  bipe(tb(b), 72 + tom(b) + 12, 0.07, 0, 0.12);
  acorde(tb(b), [48, 55, 59].map((n) => n + 12 + tom(b)), 0.5, 0.08);
});

// Cena 10: a chuva de bipes ao contrário, sem batida, e o acorde resolvido.
for (let k = 0; k < 40; k += 1) {
  const t = tb(CUE.desfaz) + (k / 40) * (tb(CUE.desfazVira) - tb(CUE.desfaz));
  bipe(t, 96 - PENTA[k % 5] - 12 * Math.floor((k % 10) / 5) + tom(CUE.desfaz), 0.04 * (k / 40 + 0.3), Math.cos(k) * 0.7, 0.04);
}
pad(tb(CUE.desfaz), tb(CUE.marcaFinal), [53, 57, 60, 64].map((n) => n + 12 + 6), 0.035);
riser(tb(CUE.desfazVira), tb(CUE.marcaFinal), 0.2);
const T = 6; // o tom final é o da última troca de wallpaper
acorde(tb(CUE.marcaFinal), [C4 + T - 12, C4 + T, C4 + T + 4, C4 + T + 7, C4 + T + 11, C4 + T + 14], 1.5, 0.15);
baixo(tb(CUE.marcaFinal), tb(CUE.marcaFinal) + 1.4, 36 + T, 0.3);
impacto(tb(CUE.marcaFinal), 0.45);
for (let k = 0; k < LINK.length; k += 1) tecla(tb(CUE.link) + k * ((tb(CUE.linkFim) - tb(CUE.link)) / LINK.length), 0.12, 0.35);
bipe(tb(CUE.marcaGiraFinal), 79 + T, 0.06, 0, 0.1);

/* ---------- efeitos que seguem a imagem ---------- */
MEDIR = false;
// Cena 1: o log corre em fusas e para seco no clique da tecla "/".
for (let t = 0.03125; t < tb(CUE.teclaAfunda) - 0.01; t += 0.0625) tique(t, Math.round(t * 16) % 2 === 0, 0.05);
varredura(tb(CUE.teclaEntra), 0.5, 0.07, 0.5);
// Cada palavra das legendas cai como uma tecla.
[
  [tb(CUE.descubra)],
  CUE.reviseTexto.map(tb),
  CUE.buildTexto.map(tb),
  [0, 0.125, 0.25].map((d) => tb(CUE.coresTexto) + d),
  [0, 0.125, 0.25].map((d) => tb(CUE.wallpaperTexto) + d),
].flat().forEach((t, k) => tecla(t, 0.45, -0.4 + (k % 3) * 0.3));
tecla(tb(CUE.barraEntra), 0.5, -0.3);
tecla(tb(CUE.enterEntra), 0.35, -0.3);
tecla(tb(CUE.msTexto), 0.4, 0.1);
tecla(tb(CUE.linhaFinal), 0.4, 0);
bipe(tb(CUE.cursorPousa), 84, 0.05, 0.4, 0.06);
// Texto que vira pixel: uma escadinha curta descendo.
function dissolver(t, nota) {
  for (let k = 0; k < 8; k += 1) bipe(t + k * 0.02, nota - PENTA[k % 5] - 12 * Math.floor(k / 5), 0.025, -0.6 + k * 0.17, 0.03);
}
[CUE.descubraSai, CUE.teclasSaem, CUE.resultadosSai, CUE.reviseSai, CUE.buildSai, CUE.coresSai].forEach((b) => dissolver(tb(b), 96 + tom(b)));
// O log da fila: um tique baixinho por linha impressa.
for (let k = 0; k < 28; k += 1) tique(tb(CUE.filaLinhas) + k * 0.125, k % 2 === 0, 0.045);
MEDIR = true;

/* ---------- reverb (Schroeder) ---------- */
function reverb(entrada, saida, desloc) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: d + desloc, buf: new Float32Array(d + desloc), i: 0 }));
  const alls = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n += 1) {
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.buf[c.i] = entrada[n] + y * 0.78;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    s *= 0.25;
    for (const a of alls) {
      const y = a.buf[a.i];
      const v = s + y * 0.5;
      a.buf[a.i] = v;
      a.i = (a.i + 1) % a.d;
      s = y - v * 0.5;
    }
    saida[n] += s * 0.6;
  }
}
reverb(revL, mixL, 0);
reverb(revR, mixR, 23);

// Saturação suave no master, para os picos não estourarem antes da
// normalização de loudness (feita pelo render com o ffmpeg).
for (let i = 0; i < N; i += 1) {
  mixL[i] = Math.tanh(mixL[i] * 0.9);
  mixR[i] = Math.tanh(mixR[i] * 0.9);
}

/* ---------- WAV float 32 ---------- */
function gravarWav(caminho, l, r) {
  const dados = Buffer.alloc(N * 8);
  for (let i = 0; i < N; i += 1) { dados.writeFloatLE(l[i], i * 8); dados.writeFloatLE(r[i], i * 8 + 4); }
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + dados.length, 4); cab.write("WAVE", 8);
  cab.write("fmt ", 12); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(3, 20); cab.writeUInt16LE(2, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 8, 28); cab.writeUInt16LE(8, 32); cab.writeUInt16LE(32, 34);
  cab.write("data", 36); cab.writeUInt32LE(dados.length, 40);
  fs.writeFileSync(caminho, Buffer.concat([cab, dados]));
}

/* ---------- medir a grade de batidas ---------- */
// Envelope de ataque da percussão em janelas de 5 ms, picos acima do
// limiar, e a grade (período + deslocamento) que melhor encaixa neles.
function medirGrade() {
  const J = Math.round(0.005 * SR);
  const env = [];
  for (let i = 0; i + J < N; i += J) {
    let s = 0;
    for (let k = 0; k < J; k += 1) s += perc[i + k] * perc[i + k];
    env.push(Math.sqrt(s / J));
  }
  const fluxo = env.map((v, i) => Math.max(0, v - (env[i - 1] || 0)));
  const max = Math.max(...fluxo);
  const ataques = [];
  for (let i = 1; i < fluxo.length - 1; i += 1) {
    if (fluxo[i] > max * 0.08 && fluxo[i] >= fluxo[i - 1] && fluxo[i] > fluxo[i + 1]) {
      const t = (i * J) / SR;
      if (!ataques.length || t - ataques[ataques.length - 1] > 0.06) ataques.push(t);
    }
  }
  let melhor = { erro: Infinity };
  for (let periodo = 0.49; periodo <= 0.51; periodo += 0.00005) {
    for (let desl = -0.02; desl <= 0.02; desl += 0.0005) {
      let erro = 0, usados = 0;
      for (const t of ataques) {
        const k = Math.round((t - desl) / periodo);
        const d = t - desl - k * periodo;
        if (Math.abs(d) < 0.03) { erro += d * d; usados += 1; }
      }
      if (usados > ataques.length * 0.5) {
        const score = erro / usados - usados * 1e-7;
        if (score < melhor.erro) melhor = { erro: score, periodo, desl, usados };
      }
    }
  }
  const beats = Array.from({ length: TOTAL_BATIDAS }, (_, k) => +(melhor.desl + k * melhor.periodo).toFixed(5));
  return { bpm: +(60 / melhor.periodo).toFixed(3), deslocamento: +melhor.desl.toFixed(4), ataques: ataques.length, encaixados: melhor.usados, beats };
}

fs.mkdirSync("build", { recursive: true });
gravarWav("build/trilha-bruta.wav", mixL, mixR);
const grade = medirGrade();
fs.writeFileSync("build/beats.json", JSON.stringify(grade, null, 2));
console.log(`trilha: ${DURACAO}s · grade medida: ${grade.bpm} BPM, deslocamento ${grade.deslocamento}s, ${grade.encaixados}/${grade.ataques} ataques na grade`);
