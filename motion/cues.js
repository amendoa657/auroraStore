// Momentos do roteiro, em batidas (120 BPM: 1 batida = 0,5 s).
// Compartilhado pelo som (audio.mjs) e pela imagem (film.js): os dois leem
// daqui, então um corte, uma tecla e um impacto sempre caem no mesmo tempo.
// A imagem converte batida em segundos pela grade MEDIDA (beats.json).

export const BPM = 120;
export const DURACAO = 30;
export const TOTAL_BATIDAS = 60;

export const CUE = {
  // Cena 1 — o terminal (0–2 s)
  teclaEntra: 0.2, // a tecla "/" começa a entrar pela direita
  teclaChega: 1.2,
  teclaAfunda: 2, // 1,0 s
  pixelizar: 3, // 1,5 s: cada letra vira um quadradinho
  pixelizarFim: 3.7,

  // Cena 2 — a marca (2–4 s)
  marcaTrava: 4, // 2,0 s: os pixels chegam e os blocos travam
  letras: [4.5, 5, 5.5, 6, 6.5, 7], // M o s a i c, em colcheias
  subtitulo: 6,
  marcaGira1: 7, // 3,5 s

  // Cena 3 — a abertura (4–6 s)
  cortinaCobre: 8,
  cortinaAbre: 9.6,
  janelaInteira: 12, // 6,0 s: impacto

  // Cena 4 — descobrir (6–10 s)
  cartoes: [12, 12.5, 13, 13.5, 14, 14.5],
  descubra: 12.5,
  cursorPasseia: 16,
  cursorPousa: 19.2,
  descubraSai: 19.5,

  // Cena 5 — buscar (10–14 s)
  barraEntra: 20,
  barraAfunda: 21,
  digita: [22, 22.25, 22.5, 22.75, 23, 23.25, 23.5], // f i r e f o x
  enterEntra: 23.7,
  enter: 24, // 12,0 s
  teclasSaem: 24.3,
  contadorFim: 25.9,
  resultadosTexto: 26, // 13,0 s
  msTexto: 26.5,
  resultadosSai: 28,

  // Cena 6 — a transição (14–16 s)
  cliqueLinha: 29, // 14,5 s

  // Cena 7 — confiança (16–18 s)
  aviso: 32,
  reviseTexto: [32, 32.5, 33, 33.5],
  pkgbuildAbre: 33,
  pkgbuildLinhas: 33.5,
  reviseSai: 35.5,

  // Cena 8 — instalar (18–22 s)
  closeComeca: 35.5,
  closeFim: 36.5,
  instalarAfunda: 37, // 18,5 s: o clique mais forte
  filaLinhas: 37.5,
  buildTexto: [38, 38.5],
  buildSai: 43.5,

  // Cena 9 — o wallpaper (22–26 s)
  marcaVolta: 43.5,
  troca1: 44, // 22 s: menta -> laranja
  coresTexto: 44.5,
  troca2: 48, // 24 s: laranja -> azul
  wallpaperTexto: 48.5,
  troca3: 50, // 25 s: azul -> menta
  coresSai: 51.5,

  // Cena 10 — o fechamento (26–30 s)
  desfaz: 52,
  desfazVira: 53.1,
  convergir: 54.2,
  marcaFinal: 56, // 28 s: acorde resolvido
  palavraFinal: 56,
  linhaFinal: 56.75,
  link: 56.9,
  linkFim: 57.8,
  marcaGiraFinal: 58, // 29 s
  congela: 59, // 29,5 s: o último quadro fica parado
};

// Os seis cartões da home (dados reais do banco) e o tom de cada ícone,
// pela mesma conta do macro `icone` do app: cada pacote tem sempre a mesma cor.
export const CARTOES = ["aur-sync-vote", "paru", "yay", "brave-origin-bin", "faugus-launcher", "chatgpt-desktop"];
export function tomDe(nome) {
  const s = "abcdefghijklmnopqrstuvwxyz0123456789".indexOf(nome[0].toLowerCase()) + nome.length * 7;
  return ((s % 4) + 4) % 4;
}
export const SUBTITULO = "pacotes do Arch, com a sua cara.";
export const LINK = "github.com/amendoa657/mosaicStore";
export const PASSO_DIGITAR = 0.03; // segundos entre letras digitadas

// Contador da busca: sobe acelerando de 0 a 745 e trava junto da palavra.
export function contador(segundosDesdeEnter, duracao) {
  const p = Math.min(Math.max(segundosDesdeEnter / duracao, 0), 1);
  return Math.floor(745 * p * p * p);
}
