import { test as base, expect } from "@playwright/test";

export const SELECTORS = {
  villain: ".villain",
  heroine: ".heroine",
  stage: ".hero",
  stageContent: ".hero-inner",
  ring: ".orbit",
  ringDot: ".orbit-sat",
  planet: ".planet",
  footer: "footer",
  page: "body",
  root: "html",
  artwork: "svg",
  arc: ".sk-arc",
  arcField: ".sk-arc-field",
  beam: ".sk-beam",
  goodBeam: ".sk-beam-good",
  evilBeam: ".sk-beam-evil",
  finisherBeam: ".sk-beam-finisher",
  inferno: ".inferno",
  wreck: ".villain-wreck",
  bodyPart: "svg g > *",
  villainCape: ".sk-cape",
  villainCapeLeft: ".sk-cape-l",
  villainTunic: ".sk-tunic",
  villainEye: ".sk-eye",
  villainArmLeft: ".sk-arm-l",
  villainArmRight: ".sk-arm-r",
  villainArmLeftLimb: ".sk-limb.sk-arm-l",
  villainArmRightLimb: ".sk-limb.sk-arm-r",
  loosePlate: '[class="sk-plate"]',
  heroineFiringArm: ".lt-arm-r",
  heroineFiringHand: ".lt-glove.lt-arm-r",
  heroineEye: ".lt-eye",
  heroineHead: "circle.lt-skin",
  burst: ".pow"
};

export const RESOURCES = {
  clickEffectStyles: "**/holy-clicks.css"
};

export const BURST_TOKENS = {
  x: "--pow-x",
  y: "--pow-y",
  anchor: "--pow-tx",
  colour: "--pow-color",
  fill: "--pow-fill",
  size: "--pow-size"
};

export const MARKERS = {
  walking: "is-walking",
  launching: "is-launching",
  landed: "is-landed",
  rallying: "is-rallying",
  summoned: "is-summoned",
  buff: "is-buff",
  charging: "is-charging",
  showdown: "is-showdown",
  victory: "is-victory",
  aftermath: "is-aftermath",
  inferno: "is-inferno",
  struckGood: "sk-struck-good",
  struckEvil: "sk-struck-evil"
};

export const TOKENS = {
  grow: "--sk-grow",
  rally: "--sk-rally",
  step: "--sk-step",
  cape: "--sk-cape",
  ringSize: "--orbit-size"
};

const CONTRACT = { selectors: SELECTORS, markers: MARKERS };

const INSTRUMENTATION = `(() => {
  const CONTRACT = ${JSON.stringify(CONTRACT)};
  const orders = new URLSearchParams(location.search);

  if (orders.has("blind")) {
    Object.defineProperty(SVGGraphicsElement.prototype, "getScreenCTM", {
      value: undefined,
      configurable: true,
      writable: true
    });
  }

  window.__log = { beams: [], bruises: [], arcFields: 0, stamps: {}, animations: [] };

  const original = Element.prototype.animate;
  Element.prototype.animate = function (frames, options) {
    const label =
      this.className && this.className.baseVal !== undefined
        ? this.className.baseVal
        : String(this.className === undefined ? "" : this.className);
    const box = this.getBoundingClientRect();
    window.__log.animations.push({
      name: label,
      tag: this.tagName.toLowerCase(),
      frames: Array.isArray(frames) ? JSON.parse(JSON.stringify(frames)) : null,
      options: typeof options === "number" ? { duration: options } : Object.assign({}, options),
      rect: { left: box.left, top: box.top, width: box.width, height: box.height }
    });
    return original.call(this, frames, options);
  };

  const WATCHED = [
    [CONTRACT.selectors.villain, CONTRACT.markers.walking],
    [CONTRACT.selectors.villain, CONTRACT.markers.launching],
    [CONTRACT.selectors.villain, CONTRACT.markers.landed],
    [CONTRACT.selectors.heroine, CONTRACT.markers.rallying],
    [CONTRACT.selectors.heroine, CONTRACT.markers.summoned],
    [CONTRACT.selectors.heroine, CONTRACT.markers.buff],
    [CONTRACT.selectors.stage, CONTRACT.markers.charging],
    [CONTRACT.selectors.page, CONTRACT.markers.showdown],
    [CONTRACT.selectors.page, CONTRACT.markers.victory],
    [CONTRACT.selectors.page, CONTRACT.markers.aftermath],
    [CONTRACT.selectors.root, CONTRACT.markers.inferno]
  ];

  const stampArrivals = () => {
    WATCHED.forEach((watch) => {
      const key = watch[0] + " " + watch[1];
      if (key in window.__log.stamps) return;
      const node = document.querySelector(watch[0]);
      if (node && node.classList.contains(watch[1])) {
        window.__log.stamps[key] = performance.now();
      }
    });
  };

  const noteAdded = (node) => {
    if (!(node instanceof Element)) return;
    const beam = CONTRACT.selectors.beam.slice(1);
    const field = CONTRACT.selectors.arcField.slice(1);
    if (node.classList.contains(beam)) window.__log.beams.push(node.className);
    if (node.classList.contains(field)) window.__log.arcFields += 1;
  };

  const cut = orders.get("cut");
  const css = orders.get("css");
  const sheet = css ? document.createElement("style") : null;
  if (sheet) sheet.textContent = css;

  const applyOrders = () => {
    if (cut) document.querySelectorAll(cut).forEach((node) => node.remove());
    if (sheet && !sheet.isConnected && document.documentElement) {
      document.documentElement.append(sheet);
    }
  };

  new MutationObserver((records) => {
    applyOrders();
    stampArrivals();
    records.forEach((record) => {
      if (record.type === "childList") {
        record.addedNodes.forEach(noteAdded);
        return;
      }
      const target = record.target;
      if (!(target instanceof Element)) return;
      [CONTRACT.markers.struckGood, CONTRACT.markers.struckEvil].forEach((bruise) => {
        if (!target.classList.contains(bruise)) return;
        const who = target.matches(CONTRACT.selectors.heroine) ? "heroine" : "villain";
        window.__log.bruises.push(who + ":" + bruise);
      });
    });
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  document.addEventListener("readystatechange", applyOrders);
})();`;

const TRACKED_SOURCES = ["epic-battle/epic-battle.js", "holy-clicks/holy-clicks.js"];

const collectedCoverage = [];

export const coverageEntries = () => collectedCoverage;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(INSTRUMENTATION);

    let started = false;
    try {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      started = true;
    } catch (_) {
      started = false;
    }

    await use(page);

    if (!started) return;

    try {
      const entries = await page.coverage.stopJSCoverage();
      entries
        .filter((entry) => TRACKED_SOURCES.some((name) => entry.url.endsWith(name)))
        .forEach((entry) => collectedCoverage.push(entry));
    } catch (_) {
      return;
    }
  }
});

export { expect };

export const SETTLE_MS = 1200;

export const angleBetween = (a, b) => {
  const dot = a.x * b.x + a.y * b.y;
  const size = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return size ? (Math.acos(Math.max(-1, Math.min(1, dot / size))) * 180) / Math.PI : 180;
};

export const turnBetween = (from, to) => ((to - from + 540) % 360) - 180;

export const bearing = (origin, point) =>
  (Math.atan2(point.y - origin.y, point.x - origin.x) * 180) / Math.PI;

export const openSite = async (page, orders) => {
  const query = new URLSearchParams(orders || {}).toString();
  await page.goto(query ? `/index.html?${query}` : "/index.html");
  await expect(page.locator(SELECTORS.villain)).toBeAttached();
};

export const clickVillain = async (page, times) => {
  const villain = page.locator(SELECTORS.villain);
  for (let click = 0; click < (times || 1); click += 1) {
    await villain.dispatchEvent("click");
  }
};

export const clickHeroine = (page) => page.locator(SELECTORS.heroine).dispatchEvent("click");

export const readLog = (page) => page.evaluate(() => window.__log);

export const animationsOn = async (page, fragment) => {
  const log = await readLog(page);
  return log.animations.filter((call) => call.name.includes(fragment));
};

export const growthClicksUntilHeLeaves = async (page) => {
  const readGrowth = () =>
    page.evaluate(
      (contract) =>
        document.querySelector(contract.villain).style.getPropertyValue(contract.grow) || null,
      { villain: SELECTORS.villain, grow: TOKENS.grow }
    );

  const sizes = [];
  const villain = page.locator(SELECTORS.villain);

  for (let click = 0; click < 12; click += 1) {
    await villain.dispatchEvent("click");
    const walking = await page.evaluate(
      (contract) => document.querySelector(contract.villain).classList.contains(contract.walking),
      { villain: SELECTORS.villain, walking: MARKERS.walking }
    );
    if (walking) return { sizes, clicksTaken: click + 1 };
    const size = await readGrowth();
    if (size !== null) sizes.push(Number(size));
  }

  return { sizes, clicksTaken: null };
};

export const waitForMarker = (page, selector, marker) =>
  page.waitForFunction(
    (contract) => {
      const node = document.querySelector(contract.selector);
      return Boolean(node) && node.classList.contains(contract.marker);
    },
    { selector, marker },
    { timeout: 40_000 }
  );

export const driveToLanded = async (page, orders) => {
  await openSite(page, orders);
  const { clicksTaken } = await growthClicksUntilHeLeaves(page);
  expect(clicksTaken, "a handful of clicks should send him on his way").toBeTruthy();
  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);
  return { villain: page.locator(SELECTORS.villain), heroine: page.locator(SELECTORS.heroine) };
};

export const driveToRally = async (page, orders) => {
  const fighters = await driveToLanded(page, orders);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.rallying);
  return fighters;
};

export const driveToStandoff = async (page, orders) => {
  const fighters = await driveToRally(page, orders);
  await clickHeroine(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.buff);
  return fighters;
};

export const driveToDefeat = async (page, orders) => {
  const fighters = await driveToRally(page, orders);
  await clickVillain(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.buff);
  await waitForMarker(page, SELECTORS.page, MARKERS.aftermath);
  return fighters;
};

export const settleAfterVictory = (page) => waitForMarker(page, SELECTORS.page, MARKERS.victory);

export const settleAfterDefeat = (page) => waitForMarker(page, SELECTORS.page, MARKERS.aftermath);

export const settleHeroineHome = (page) =>
  page.waitForFunction(
    (selector) => {
      const her = document.querySelector(selector);
      return Boolean(her) && her.getAnimations().length === 0;
    },
    SELECTORS.heroine,
    { timeout: 40_000 }
  );

export const settlePose = (page, selector) =>
  page.waitForFunction(
    (target) => {
      const node = document.querySelector(target);
      if (!node) return false;
      const running = node.getAnimations();
      return running.length > 0 && running.every((move) => move.playState === "finished");
    },
    selector,
    { timeout: 30_000 }
  );

export const waitForArcs = (page) =>
  page.waitForFunction(
    (selector) => document.querySelectorAll(selector).length > 0,
    `${SELECTORS.villain} ${SELECTORS.arc}`,
    { timeout: 40_000 }
  );

export const measureAim = (page) =>
  page.evaluate((contract) => {
    const heroine = document.querySelector(contract.heroine);
    const villain = document.querySelector(contract.villain);
    const artwork = heroine.querySelector(contract.artwork);
    const arm = heroine.querySelector(contract.firingArm);

    const pivot = getComputedStyle(arm).transformOrigin.split(" ").map(parseFloat);
    const transformBox = getComputedStyle(arm).transformBox;

    const onScreen = (x, y) => {
      const point = artwork.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(artwork.getScreenCTM());
      return { x: mapped.x, y: mapped.y };
    };

    const centreOf = (node) => {
      const box = node.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    return {
      transformBox,
      shoulder: onScreen(pivot[0], pivot[1]),
      hand: centreOf(heroine.querySelector(contract.firingHand)),
      villain: centreOf(villain),
      head: centreOf(heroine.querySelector(contract.head))
    };
  }, {
    heroine: SELECTORS.heroine,
    villain: SELECTORS.villain,
    artwork: SELECTORS.artwork,
    firingArm: SELECTORS.heroineFiringArm,
    firingHand: SELECTORS.heroineFiringHand,
    head: SELECTORS.heroineHead
  });

export const readRingAndVillain = (page) =>
  page.evaluate((contract) => {
    const ring = document.querySelector(contract.ring);
    const villain = document.querySelector(contract.villain);
    const ringBox = ring.getBoundingClientRect();
    const villainBox = villain.getBoundingClientRect();

    return {
      ringCentre: { x: ringBox.left + ringBox.width / 2, y: ringBox.top + ringBox.height / 2 },
      ringRadius: ring.offsetWidth / 2,
      ringSpunWidth: ringBox.width,
      villainCentre: {
        x: villainBox.left + villainBox.width / 2,
        y: villainBox.top + villainBox.height / 2
      },
      villainSize: { width: villainBox.width, height: villainBox.height }
    };
  }, { ring: SELECTORS.ring, villain: SELECTORS.villain });

export const readArcs = (page) =>
  page.evaluate((contract) => {
    const villain = document.querySelector(contract.villain);
    const artwork = villain.querySelector(contract.artwork);
    const drawn = artwork.getBoundingClientRect();
    const perUnit = drawn.height / artwork.viewBox.baseVal.height || 1;
    const ring = document.querySelector(contract.ring);

    const ringInUserUnits = () => {
      if (!ring) return null;
      const box = ring.getBoundingClientRect();
      return {
        centre: {
          x: (box.left + box.width / 2 - drawn.left) / perUnit,
          y: (box.top + box.height / 2 - drawn.top) / perUnit
        },
        radius: ring.offsetWidth / 2 / perUnit
      };
    };

    const arcs = [...artwork.querySelectorAll(contract.arc)].map((arc) => {
      const points = arc
        .getAttribute("points")
        .split(" ")
        .map((pair) => {
          const parts = pair.split(",").map(Number);
          return { x: parts[0], y: parts[1] };
        });
      return { points, first: points[0], last: points[points.length - 1] };
    });

    return {
      arcs,
      ring: ringInUserUnits(),
      perUnit,
      artworkCentre: {
        x: artwork.viewBox.baseVal.width / 2,
        y: artwork.viewBox.baseVal.height / 2
      }
    };
  }, { villain: SELECTORS.villain, artwork: SELECTORS.artwork, ring: SELECTORS.ring, arc: SELECTORS.arc });

export const groupArcsByOrigin = (arcs) => {
  const groups = [];
  arcs.forEach((arc) => {
    const home = groups.find(
      (group) =>
        Math.abs(group[0].first.x - arc.first.x) < 0.005 &&
        Math.abs(group[0].first.y - arc.first.y) < 0.005
    );
    if (home) home.push(arc);
    else groups.push([arc]);
  });
  return groups;
};

export const readCustomProperty = (page, selector, property) =>
  page.evaluate(
    (contract) =>
      getComputedStyle(document.querySelector(contract.selector))
        .getPropertyValue(contract.property)
        .trim(),
    { selector, property }
  );

export const readPalette = (page) =>
  page.evaluate((tokens) => {
    const root = getComputedStyle(document.documentElement);
    const palette = {};
    tokens.forEach((token) => {
      palette[token] = root.getPropertyValue(token).trim();
    });
    return palette;
  }, ["--bg", "--accent", "--green", "--gold", "--text"]);

export const asRgb = (page, colour) =>
  page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, colour);

export const brightnessOf = (colour) => {
  const channels = colour.match(/\d+(\.\d+)?/g);
  if (!channels || channels.length < 3) return null;
  return (Number(channels[0]) + Number(channels[1]) + Number(channels[2])) / 3;
};

export const rednessOf = (colour) => {
  const channels = colour.match(/\d+(\.\d+)?/g);
  if (!channels || channels.length < 3) return null;
  return Number(channels[0]) - Number(channels[2]);
};
