// Render do filme.
//
//   node render.mjs                 trilha + 1800 quadros -> ../resultados/01-teste.mp4
//   node render.mjs --folha         uma imagem por batida, em folhas de contato (build/folha-*.png)
//   node render.mjs --quadro 13.2   um quadro em tamanho cheio (build/quadro-13.2.png)
//
// A trilha é sintetizada pelo audio.mjs, normalizada para -14 LUFS pelo
// ffmpeg (loudnorm em duas passadas) e o vídeo sai em H.264 yuv420p, CRF 16.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const BUILD = path.join(AQUI, "build");
const SAIDA = path.join(RAIZ, "resultados", "01-teste.mp4");
const FPS = 60;
const DURACAO = 30;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2);
const modoFolha = args.includes("--folha");
const iQuadro = args.indexOf("--quadro");
const tQuadro = iQuadro >= 0 ? Number(args[iQuadro + 1]) : null;

function rodar(cmd, argv, { mostrar = false } = {}) {
  const r = spawnSync(cmd, argv, { cwd: AQUI, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "");
    throw new Error(`${cmd} saiu com ${r.status}`);
  }
  if (mostrar) process.stdout.write(r.stdout);
  return r;
}

/* ---------- Som ---------- */
function trilha() {
  rodar("node", ["audio.mjs"], { mostrar: true });
  const bruta = path.join(BUILD, "trilha-bruta.wav");
  const final = path.join(BUILD, "trilha.wav");
  const alvo = "I=-14:TP=-1:LRA=11";
  const p1 = rodar("ffmpeg", ["-hide_banner", "-nostats", "-i", bruta, "-af", `loudnorm=${alvo}:print_format=json`, "-f", "null", "-"]);
  const m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf("{")));
  const medido = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
  const normal = path.join(BUILD, "trilha-normal.wav");
  rodar("ffmpeg", ["-hide_banner", "-nostats", "-y", "-i", bruta, "-af", `loudnorm=${alvo}:${medido}:linear=true`, "-ar", "48000", "-c:a", "pcm_f32le", normal]);
  // O loudnorm linear chega perto; um ajuste fino de ganho crava -14.
  const medir = (arq) => {
    const r = rodar("ffmpeg", ["-hide_banner", "-nostats", "-i", arq, "-af", "ebur128=peak=true", "-f", "null", "-"]);
    const resumo = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
    return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(resumo)[1]), pico: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(resumo)[1]) };
  };
  const antes = medir(normal);
  const ganho = (-14 - antes.lufs).toFixed(2);
  rodar("ffmpeg", ["-hide_banner", "-nostats", "-y", "-i", normal, "-af", `volume=${ganho}dB`, "-ar", "48000", "-c:a", "pcm_s16le", final]);
  const fim = medir(final);
  console.log(`trilha: ${fim.lufs} LUFS integrado, pico real ${fim.pico} dBTP (bruta: ${m.input_i} LUFS, ajuste ${ganho} dB)`);
  if (fim.pico > -1) console.warn("aviso: pico real acima de -1 dBTP");
  return final;
}

/* ---------- Servidor estático (a raiz do repositório, para as fontes do app) ---------- */
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png" };
function servir() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const p = path.join(RAIZ, decodeURIComponent(new URL(req.url, "http://x").pathname));
      if (!p.startsWith(RAIZ) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": TIPOS[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
      fs.createReadStream(p).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => ok(s));
  });
}

async function abrir(porta) {
  const nav = await chromium.launch({ executablePath: CHROME, args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });
  const pagina = await nav.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(e.message));
  pagina.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && erros.push(m.text()));
  pagina.on("response", (r) => r.status() >= 400 && !r.url().endsWith("favicon.ico") && erros.push(`${r.status()} ${r.url()}`));
  await pagina.goto(`http://127.0.0.1:${porta}/motion/film.html`);
  await pagina.evaluate(() => window.pronto);
  return { nav, pagina, erros };
}

function conferir(erros, onde) {
  if (!erros.length) return;
  console.error(`erros na página (${onde}):\n  ` + [...new Set(erros)].join("\n  "));
  process.exit(1);
}

/* ---------- Folhas de contato: um quadro por batida ---------- */
async function folhas(pagina, erros) {
  const batidas = JSON.parse(fs.readFileSync(path.join(BUILD, "beats.json"), "utf8")).beats;
  // Um pouco depois da batida, para ver o golpe já dado.
  const tempos = batidas.map((b) => Math.min(b + 0.12, DURACAO - 0.01));
  const POR_FOLHA = 20;
  for (let f = 0; f * POR_FOLHA < tempos.length; f += 1) {
    const parte = tempos.slice(f * POR_FOLHA, (f + 1) * POR_FOLHA);
    const png = await pagina.evaluate(async ({ parte, inicio }) => {
      const filme = document.getElementById("filme");
      const COL = 5, TW = 384, TH = 216, RT = 26;
      const folha = document.createElement("canvas");
      folha.width = COL * TW;
      folha.height = Math.ceil(parte.length / COL) * (TH + RT);
      const c = folha.getContext("2d");
      c.fillStyle = "#000";
      c.fillRect(0, 0, folha.width, folha.height);
      parte.forEach((t, k) => {
        window.seek(t);
        const x = (k % COL) * TW;
        const y = Math.floor(k / COL) * (TH + RT);
        c.drawImage(filme, x, y, TW, TH);
        c.fillStyle = "#fff";
        c.font = '500 15px "JetBrains Mono"';
        c.fillText(`batida ${inicio + k} · ${t.toFixed(2)} s`, x + 8, y + TH + 18);
      });
      return folha.toDataURL("image/png");
    }, { parte, inicio: f * POR_FOLHA });
    const arq = path.join(BUILD, `folha-${f + 1}.png`);
    fs.writeFileSync(arq, Buffer.from(png.split(",")[1], "base64"));
    console.log(arq);
  }
  conferir(erros, "folha");
}

async function umQuadro(pagina, erros, t) {
  await pagina.evaluate((t) => window.seek(t), t);
  const arq = path.join(BUILD, `quadro-${t}.png`);
  await pagina.screenshot({ path: arq, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  conferir(erros, `quadro ${t}`);
  console.log(arq);
}

/* ---------- Render completo ---------- */
async function filme(pagina, erros, audio) {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const ff = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-i", audio,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-c:a", "aac", "-b:a", "192k",
    "-t", String(DURACAO), "-movflags", "+faststart", SAIDA,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const fim = new Promise((ok, falha) => ff.on("close", (s) => (s === 0 ? ok() : falha(new Error(`ffmpeg saiu com ${s}`)))));
  const total = FPS * DURACAO;
  const inicio = Date.now();
  for (let i = 0; i < total; i += 1) {
    await pagina.evaluate((t) => window.seek(t), i / FPS);
    const png = await pagina.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    if (!ff.stdin.write(png)) await new Promise((ok) => ff.stdin.once("drain", ok));
    if (erros.length) break;
    if (i % 120 === 0) console.log(`quadro ${i}/${total} (${((Date.now() - inicio) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  conferir(erros, "render");
  await fim;
  console.log(`pronto: ${SAIDA}`);
}

/* ---------- Principal ---------- */
fs.mkdirSync(BUILD, { recursive: true });
const audio = modoFolha || tQuadro !== null ? (rodar("node", ["audio.mjs"], { mostrar: true }), null) : trilha();
const servidor = await servir();
const { nav, pagina, erros } = await abrir(servidor.address().port);
conferir(erros, "carregar");
try {
  if (modoFolha) await folhas(pagina, erros);
  else if (tQuadro !== null) await umQuadro(pagina, erros, tQuadro);
  else await filme(pagina, erros, audio);
} finally {
  await nav.close();
  servidor.close();
}
