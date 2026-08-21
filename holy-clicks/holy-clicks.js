(() => {
  "use strict";

  const triggerEls = document.querySelectorAll(".sidekick-corner");

  const WORDS = [
    "AIEEE!", "AIIEEE!", "ARRGH!", "ARRGGHH!", "AWK!", "AWKKKKKK!", "BAM!", "BANG!", "BANG-ETH!", "BIFF!",
    "BLOOP!", "BLURP!", "BOFF!", "BONK!", "BONG!", "BOOM!", "CLANK!", "CLANK-EST!", "CLASH!", "CLICK!",
    "CLUNK!", "CLUNK-ETH!", "CRACK!", "CRAAACK!", "CRASH!", "CRRAAACK!", "CRUNCH!", "CRUNCH-ETH!", "EEE-YOW!",
    "FLRBBBBB!", "GLIPP!", "GLURPP!", "HURT!", "KAPOW!", "KAYO!", "KER-SPLOOSH!", "KER-PLOP!", "KLONK!",
    "KLUNK!", "KRUNCH!", "OOOFF!", "OOOOFF!", "OUCH!", "OUCH-ETH!", "OWWW!", "PAM!", "PLOP!", "POW!", "POWIE!",
    "QUNCKKK!", "RAKKK!", "RIP!", "SLOSH!", "SMASH!", "SNAP!", "SOCK!", "SPLAAT!", "SPLATS!", "SPLATT!",
    "SPLOOSH!", "SWAAP!", "SWISH!", "SWOOSH!", "THUNK!", "THWACK!", "THWACKE!", "THWAP!", "THWAPE!", "THWAPP!",
    "TOUCHE!", "UGGH!", "URKK!", "URKKK!", "VRONK!", "WHAM!", "WHACK!", "WHACK-ETH!", "WHAM-ETH!", "WHAMM!",
    "WHAMMM!", "WHAP!", "Z-ZWAP!", "ZAM!", "ZAMM!", "ZAP!", "ZAP-ETH!", "ZGRUPPP!", "ZLONK!", "ZLOPP!",
    "ZLOTT!", "ZOK!", "ZOWIE!", "ZWAPP!", "ZZONK!", "ZZWAP!", "ZZZZWAP!", "ZZZZZWAP!", "ZZZZZZWAP!"
  ];
  const COLOR_TOKENS = ["--pow-1", "--pow-2", "--pow-3", "--pow-4"];
  const BURST_TOKENS = ["--burst-1", "--burst-2", "--burst-3"];
  const CURSOR_GAP = 25;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const readTokens = (names) => {
    const root = getComputedStyle(document.documentElement);
    return names.map((name) => root.getPropertyValue(name).trim()).filter(Boolean);
  };

  const colors = readTokens(COLOR_TOKENS);
  const burstFills = readTokens(BURST_TOKENS);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const burstPoints = (spikes) =>
    Array.from({ length: spikes * 2 }, (_, i) => {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radius = (i % 2 === 0 ? 46 : 22) * randomBetween(0.88, 1.12);
      const x = (50 + radius * Math.cos(angle)).toFixed(1);
      const y = (50 + radius * Math.sin(angle)).toFixed(1);
      return `${x},${y}`;
    }).join(" ");

  const spawnBurst = (clientX, clientY) => {
    const placeRight = clientX < window.innerWidth / 2;

    const pow = document.createElement("div");
    pow.className = "pow";
    pow.ariaHidden = "true";
    Object.entries({
      "--pow-x": `${placeRight ? clientX + CURSOR_GAP : clientX - CURSOR_GAP}px`,
      "--pow-y": `${clientY}px`,
      "--pow-tx": placeRight ? "0%" : "-100%",
      "--pow-rot": `${randomBetween(-15, 15).toFixed(2)}deg`,
      "--pow-size": `${Math.floor(randomBetween(28, 41))}px`,
      "--pow-color": pick(colors),
      "--pow-fill": pick(burstFills)
    }).forEach(([token, value]) => pow.style.setProperty(token, value));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", burstPoints(Math.floor(randomBetween(9, 13))));
    svg.append(polygon);

    const label = document.createElement("span");
    label.textContent = pick(WORDS);

    pow.append(svg, label);
    pow.addEventListener("animationend", () => pow.remove(), { once: true });
    document.body.append(pow);
  };

  const burstOrigin = (event, fallbackEl) => {
    if (event.detail !== 0) return [event.clientX, event.clientY];
    const el = fallbackEl ?? (event.target instanceof Element ? event.target : null);
    const rect = el?.getBoundingClientRect();
    return rect
      ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
      : [window.innerWidth / 2, window.innerHeight / 2];
  };

  if (triggerEls.length && colors.length && burstFills.length) {
    let armed = false;

    triggerEls.forEach((triggerEl) => {
      triggerEl.addEventListener(
        "click",
        (event) => {
          if (armed) return;
          armed = true;
          document.addEventListener(
            "click",
            (e) => {
              if (e.target instanceof Element && e.target.closest(".sidekick-atmo")) return;
              spawnBurst(...burstOrigin(e));
            },
            { capture: true }
          );
          spawnBurst(...burstOrigin(event, triggerEl));
        },
        { once: true }
      );
    });
  }
})();
