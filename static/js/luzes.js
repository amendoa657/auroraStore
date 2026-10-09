/* Física leve para o campo líquido de luzes.
   As manchas orbitam, se atraem quando se aproximam e uma quarta mancha
   acompanha a mistura delas para criar a sensação de tinta luminosa. */
(function () {
  const area = document.querySelector("[data-fundo-luzes]");
  if (!area) return;

  const semMovimento =
    document.documentElement.classList.contains("sem-animacoes") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const luzes = [
    { x: 18, y: 20, vx: 0, vy: 0, ax: 18, ay: 12, velocidade: 0.72, fase: 0.4 },
    { x: 82, y: 26, vx: 0, vy: 0, ax: 18, ay: 15, velocidade: 0.58, fase: 2.2 },
    { x: 54, y: 78, vx: 0, vy: 0, ax: 20, ay: 15, velocidade: 0.46, fase: 4.5 },
    { x: 50, y: 50, vx: 0, vy: 0, ax: 14, ay: 15, velocidade: 0.82, fase: 1.4 },
  ];

  const ponteiro = { x: 0.5, y: 0.5 };
  let ultimoTempo = performance.now();

  function definirPosicao(indice, x, y) {
    area.style.setProperty(`--luz-${indice + 1}-x`, `${x}%`);
    area.style.setProperty(`--luz-${indice + 1}-y`, `${y}%`);
  }

  function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
  }

  /* Cada abertura recebe uma composição inicial própria. */
  luzes.forEach((luz, indice) => {
    const variacao = indice === 3 ? 6 : 10;
    luz.x += (Math.random() - 0.5) * variacao;
    luz.y += (Math.random() - 0.5) * variacao;
    definirPosicao(indice, luz.x, luz.y);
  });

  if (semMovimento) return;

  function atualizar(agora) {
    const delta = Math.min((agora - ultimoTempo) / 1000, 0.034);
    const tempo = agora / 1000;
    ultimoTempo = agora;

    const centroX = (ponteiro.x - 0.5) * 7;
    const centroY = (ponteiro.y - 0.5) * 7;

    /* As três cores principais fazem órbitas lentas e procuram seus alvos. */
    for (let indice = 0; indice < 3; indice += 1) {
      const luz = luzes[indice];
      const alvoX =
        luz.x +
        Math.sin(tempo * luz.velocidade + luz.fase) * luz.ax +
        centroX * (indice % 2 === 0 ? 1 : -1);
      const alvoY =
        luz.y +
        Math.cos(tempo * luz.velocidade * 0.78 + luz.fase) * luz.ay +
        centroY;

      luz.vx += (alvoX - luz.x) * delta * 0.9;
      luz.vy += (alvoY - luz.y) * delta * 0.9;
      luz.vx *= 0.985;
      luz.vy *= 0.985;
      luz.x += luz.vx * delta * 7;
      luz.y += luz.vy * delta * 7;
    }

    /* Quando duas manchas chegam perto, elas se atraem suavemente: as cores
       se encontram no mesmo ponto e o blend-mode do CSS soma os pigmentos. */
    for (let primeiro = 0; primeiro < 3; primeiro += 1) {
      for (let segundo = primeiro + 1; segundo < 3; segundo += 1) {
        const a = luzes[primeiro];
        const b = luzes[segundo];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distancia = Math.hypot(dx, dy);

        if (distancia > 1 && distancia < 62) {
          const atracao = (62 - distancia) * delta * 0.009;
          a.vx += dx * atracao;
          a.vy += dy * atracao;
          b.vx -= dx * atracao;
          b.vy -= dy * atracao;
        }
      }
    }

    /* A quarta mancha é uma emulsão viva do centro das três outras. */
    const misturaX = (luzes[0].x + luzes[1].x + luzes[2].x) / 3;
    const misturaY = (luzes[0].y + luzes[1].y + luzes[2].y) / 3;
    const hibrida = luzes[3];
    const alvoHibridoX = misturaX + Math.sin(tempo * 0.9) * hibrida.ax;
    const alvoHibridoY = misturaY + Math.cos(tempo * 0.72) * hibrida.ay;
    hibrida.x += (alvoHibridoX - hibrida.x) * delta * 1.6;
    hibrida.y += (alvoHibridoY - hibrida.y) * delta * 1.6;

    luzes.forEach((luz, indice) => {
      luz.x = limitar(luz.x, -8, 108);
      luz.y = limitar(luz.y, -8, 108);
      definirPosicao(indice, luz.x, luz.y);
    });

    requestAnimationFrame(atualizar);
  }

  requestAnimationFrame(atualizar);

  document.addEventListener(
    "pointermove",
    (evento) => {
      ponteiro.x = evento.clientX / window.innerWidth;
      ponteiro.y = evento.clientY / window.innerHeight;
    },
    { passive: true },
  );

  document.addEventListener("click", (evento) => {
    area.style.setProperty("--pulso-x", `${evento.clientX}px`);
    area.style.setProperty("--pulso-y", `${evento.clientY}px`);
    area.style.setProperty(
      "--pulso-cor",
      evento.clientX < window.innerWidth / 2
        ? "color-mix(in srgb, var(--corDestaque) 26%, transparent)"
        : "color-mix(in srgb, var(--corAcentoSecundario) 26%, transparent)",
    );
    area.classList.remove("luzes-pulsando");
    void area.offsetWidth;
    area.classList.add("luzes-pulsando");
    window.setTimeout(() => area.classList.remove("luzes-pulsando"), 900);
  });
})();
