(() => {
  "use strict";

  const armSwitches = document.querySelectorAll(".heroine");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const SOUND_EFFECTS = [
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

  const readPaletteTokens = (names) => {
    const root = getComputedStyle(document.documentElement);
    return names.map((name) => root.getPropertyValue(name).trim()).filter(Boolean);
  };

  const wordColors = readPaletteTokens(COLOR_TOKENS);
  const starburstFills = readPaletteTokens(BURST_TOKENS);
  const pickOne = (items) => items[Math.floor(Math.random() * items.length)];
  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const starburstPoints = (spikes) =>
    Array.from({ length: spikes * 2 }, (_, i) => {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const radius = (i % 2 === 0 ? 46 : 22) * randomBetween(0.88, 1.12);
      const x = (50 + radius * Math.cos(angle)).toFixed(1);
      const y = (50 + radius * Math.sin(angle)).toFixed(1);
      return `${x},${y}`;
    }).join(" ");

  const stampSoundEffect = (clientX, clientY) => {
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
      "--pow-color": pickOne(wordColors),
      "--pow-fill": pickOne(starburstFills)
    }).forEach(([token, value]) => pow.style.setProperty(token, value));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", starburstPoints(Math.floor(randomBetween(9, 13))));
    svg.append(polygon);

    const label = document.createElement("span");
    label.textContent = pickOne(SOUND_EFFECTS);

    pow.append(svg, label);
    pow.addEventListener("animationend", () => pow.remove(), { once: true });
    document.body.append(pow);
  };

  const pointOfImpact = (event, fallbackEl) => {
    if (event.detail !== 0) return [event.clientX, event.clientY];
    const el = fallbackEl ?? (event.target instanceof Element ? event.target : null);
    const rect = el?.getBoundingClientRect();
    return rect
      ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
      : [window.innerWidth / 2, window.innerHeight / 2];
  };

  if (armSwitches.length && wordColors.length && starburstFills.length) {
    let armed = false;
    let lockedOff = false;

    const stampOnEveryClick = (event) => {
      if (reducedMotion.matches) return;
      if (event.target instanceof Element && event.target.closest(".fighter")) return;
      stampSoundEffect(...pointOfImpact(event));
    };

    const stopStamping = () => {
      if (!armed) return;
      armed = false;
      document.removeEventListener("click", stampOnEveryClick, { capture: true });
    };

    document.addEventListener("holyclicks:disable", () => {
      lockedOff = true;
      stopStamping();
    });

    armSwitches.forEach((armSwitch) => {
      armSwitch.addEventListener("click", (event) => {
        if (lockedOff || reducedMotion.matches) return;

        if (armed) {
          stopStamping();
          return;
        }

        armed = true;
        document.addEventListener("click", stampOnEveryClick, { capture: true });
        stampSoundEffect(...pointOfImpact(event, armSwitch));
      });
    });
  }
})();
