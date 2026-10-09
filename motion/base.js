// Peças de desenho compartilhadas pelo filme (film.js) e pelos GIFs do
// README (gifs.js): matemática de tempo, o acaso com semente, as paletas do
// matugen, as fontes, a tecla, a marca, o cursor e o campo de pixels.
import { tomDe } from "./cues.js";

/* =====================================================================
   Tempo e matemática
   ===================================================================== */
export const limitar = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
export const lerp = (a, b, p) => a + (b - a) * p;
export const trecho = (t, a, b) => limitar((t - a) / (b - a));
export const saida = (p) => 1 - Math.pow(1 - p, 3);
export const meio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export function mulberry32(a) {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Número "aleatório" fixo para uma combinação de inteiros.
export function acaso(...ns) {
  let h = 2166136261;
  for (const n of ns) h = Math.imul(h ^ (n | 0), 16777619);
  return mulberry32(h);
}

/* =====================================================================
   Cores, fontes e formas
   ===================================================================== */
export const PALETAS = {
  menta: {
    primary: "#86d7ac", onPrimary: "#003823", secondary: "#e9b9d3", secCont: "#5f3c51",
    tertiary: "#b5c5f9", terCont: "#354571", terText: "#dae2ff", light: "#e6e0ec",
    win: "#14121a", header: "#211e26", side: "#211e26", side2: "#1d1a22", card: "#211e26",
    cardHover: "#2b2630", view: "#0f0d15", popup: "#36333c", text: "#e6e0ec",
    danger: "#ffb4ab", dangerBg: "#93000a", dangerText: "#ffdad6",
  },
  laranja: {
    primary: "#ffb77c", onPrimary: "#4a2800", secondary: "#e2c0a4", secCont: "#5a4330",
    tertiary: "#c1cc8f", terCont: "#414b1d", terText: "#dde8a9", light: "#f0dfd5",
    win: "#19120c", header: "#261e17", side: "#261e17", side2: "#211a14", card: "#2b231c",
    cardHover: "#352b22", view: "#140d08", popup: "#3c332b", text: "#f0dfd5",
    danger: "#ffb4ab", dangerBg: "#93000a", dangerText: "#ffdad6",
  },
  azul: {
    primary: "#a8c8ff", onPrimary: "#003062", secondary: "#bdc7dc", secCont: "#3e4759",
    tertiary: "#dbbce1", terCont: "#563e5c", terText: "#f8d8fd", light: "#e2e2e9",
    win: "#111318", header: "#1d2024", side: "#1d2024", side2: "#191c20", card: "#22252a",
    cardHover: "#2a2e34", view: "#0c0e13", popup: "#33353a", text: "#e2e2e9",
    danger: "#ffb4ab", dangerBg: "#93000a", dangerText: "#ffdad6",
  },
};
export const PRETO = "#0b0a10";

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
export function misturar(h1, h2, p) {
  const a = parseInt(h1.slice(1), 16);
  const b = parseInt(h2.slice(1), 16);
  const c = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, p));
  return "#" + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}
export const corTom = (pal, k) => [pal.primary, pal.secondary, pal.tertiary, misturar(pal.secondary, pal.tertiary, 0.5)][k];
export const coresMarca = (pal) => [pal.primary, pal.secondary, pal.tertiary, pal.light];
export const borda = (hex) => misturar(hex, "#000000", 0.5);

export const DISP = '"Space Grotesk"';
export const MONO = '"JetBrains Mono"';
export function fonte(c, peso, tam, fam = DISP) {
  c.font = `${peso} ${tam}px ${fam}`;
}
export function texto(c, s, x, y, { peso = 400, tam = 13, fam = DISP, cor = "#fff", esp = 0, alinhar = "left" } = {}) {
  fonte(c, peso, tam, fam);
  c.letterSpacing = `${esp}px`;
  c.textAlign = alinhar;
  c.fillStyle = cor;
  c.fillText(s, x, y);
  c.letterSpacing = "0px";
  c.textAlign = "left";
}
export function cortar(c, s, max) {
  if (c.measureText(s).width <= max) return s;
  while (s.length > 1 && c.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}
export function caixa(c, x, y, w, h, r, cor) {
  c.fillStyle = cor;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
export function circulo(c, x, y, r, cor) {
  c.fillStyle = cor;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

// Tecla: a face por cima de uma borda mais escura que some quando ela desce.
export function tecla(c, x, y, w, h, { face, cor, raio = 10, afundar = 0, E }) {
  const e = E ?? Math.max(3, Math.round(h * 0.07));
  caixa(c, x, y + e, w, h, raio, cor ?? borda(face));
  const yf = y + e * afundar;
  caixa(c, x, yf, w, h, raio, face);
  return yf;
}
// Curva de uma tecla apertada em t0: desce rápido, segura e volta.
export function aperto(t, t0, segura = 0.05) {
  const d = t - t0;
  if (d < 0) return 0;
  if (d < 0.05) return saida(d / 0.05);
  if (d < 0.05 + segura) return 1;
  if (d < 0.17 + segura) return 1 - saida((d - 0.05 - segura) / 0.12);
  return 0;
}
// Entrada "tecla afundando": cai acelerando, toca exatamente em t0 (onde
// está o som) e afunda no lugar.
export const QUEDA = 0.08;
export function cair(t, t0, altura = 40, E = 8) {
  const d = t - t0 + QUEDA;
  if (d < 0) return null;
  if (d < QUEDA) {
    const p = d / QUEDA;
    return { dy: -E - altura * (1 - p * p), borda: true };
  }
  if (d < QUEDA + 0.07) return { dy: -E * (1 - saida((d - QUEDA) / 0.07)), borda: true };
  return { dy: 0, borda: false };
}

// A marca: quatro blocos. `giro` em quartos de volta.
export function marca(c, cx, cy, tam, giro, cores) {
  const b = tam * 0.44;
  const r = Math.max(1.5, tam * 0.03);
  c.save();
  c.translate(cx, cy);
  c.rotate((giro * Math.PI) / 2);
  const pos = [[-tam / 2, -tam / 2], [tam / 2 - b, -tam / 2], [-tam / 2, tam / 2 - b], [tam / 2 - b, tam / 2 - b]];
  pos.forEach(([x, y], k) => caixa(c, x, y, b, b, r, cores[k]));
  c.restore();
}

export function cursor(c, x, y, aperta = 0) {
  const s = 1.55 * (1 - 0.12 * aperta);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 25);
  c.lineTo(6, 19.5);
  c.lineTo(10.5, 29.5);
  c.lineTo(14.6, 27.8);
  c.lineTo(10.2, 18);
  c.lineTo(17.8, 18);
  c.closePath();
  c.fillStyle = "#f6f4f9";
  c.fill();
  c.lineWidth = 1.6;
  c.strokeStyle = PRETO;
  c.stroke();
  c.restore();
}

/* =====================================================================
   O campo de pixels (a mesma conta do pixels.js do app)
   ===================================================================== */
export const CAMPOS = [
  { fx: 0.0062, fy: 0.0048, vx: 0.05, vy: 0.032, torcao: 1.7, fase: 0.0 },
  { fx: 0.0051, fy: 0.0069, vx: -0.041, vy: 0.046, torcao: 1.4, fase: 2.1 },
  { fx: 0.0072, fy: 0.0055, vx: 0.036, vy: -0.052, torcao: 1.9, fase: 4.4 },
];
export function campo(c, x, y, t) {
  const u = x * c.fx + t * c.vx + Math.sin(y * c.fy * 0.7 + t * 0.07 + c.fase) * c.torcao;
  const v = y * c.fy + t * c.vy + Math.cos(x * c.fx * 0.6 - t * 0.05 + c.fase) * c.torcao;
  return Math.sin(u) * Math.cos(v);
}
export function corDoCampo(x, y, tf) {
  let k = 0;
  let f = -Infinity;
  for (let i = 0; i < 3; i += 1) {
    const v = campo(CAMPOS[i], x, y, tf);
    if (v > f) {
      f = v;
      k = i;
    }
  }
  return [k, f];
}
export function ladoDoCampo(f, lente, s) {
  const nivel = Math.max(0, (f - 0.35) / 0.65) + lente * 0.55;
  if (nivel <= 0.02) return { lado: (1 + lente * 1.5) * s, neutro: true };
  return { lado: Math.min(1.5 + nivel * 4, 9) * s, neutro: false };
}
export function forcaLente(x, y, lente) {
  if (!lente) return 0;
  const d = Math.hypot(x - lente.x, y - lente.y);
  if (d >= lente.r) return 0;
  const q = 1 - d / lente.r;
  return q * q;
}

/* =====================================================================
   Peças da interface
   ===================================================================== */
export function selo(c, x, y, rotulo, pal, oficial = false) {
  fonte(c, 500, 10.5, MONO);
  const w = c.measureText(rotulo).width + 14;
  caixa(c, x, y, w, 20, 5, oficial ? pal.terCont : "rgba(147, 0, 10, 0.55)");
  texto(c, rotulo, x + 7, y + 14, { peso: 500, tam: 10.5, fam: MONO, cor: oficial ? pal.terText : pal.danger });
  return w;
}
export function iconeApp(c, x, y, tam, nome, pal, raio = 11) {
  const cor = corTom(pal, tomDe(nome));
  caixa(c, x, y + Math.max(2, tam * 0.05), tam, tam, raio, borda(cor));
  caixa(c, x, y, tam, tam, raio, cor);
  texto(c, nome[0].toUpperCase(), x + tam / 2, y + tam * 0.66, { peso: 700, tam: tam * 0.42, fam: MONO, cor: misturar(cor, "#000000", 0.78), alinhar: "center" });
}

// As duas fontes do app, servidas pelo próprio repositório.
export async function carregarFontes(raiz = "../static/fonts") {
  const fontes = [
    new FontFace("Space Grotesk", `url(${raiz}/space-grotesk.woff2)`, { weight: "300 700" }),
    new FontFace("JetBrains Mono", `url(${raiz}/jetbrains-mono.woff2)`, { weight: "100 800" }),
  ];
  for (const f of fontes) {
    await f.load();
    document.fonts.add(f);
  }
}
