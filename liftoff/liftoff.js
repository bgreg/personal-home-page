(() => {
  "use strict";

  const sidekick = document.querySelector(".sidekick-atmo");
  const planet = document.querySelector(".planet");
  if (!sidekick || !planet) return;

  const GROWTH_CLICKS = 3;
  const GROWTH_STEP = 1.2;
  const WALK_SPEED = 220;
  const WALK_STEP_MS = 460;
  const WALK_SAMPLES = 60;
  const TILT_BLEND = 0.18;
  const BOB_HEIGHT = 2.5;
  const EDGE_MARGIN = 56;
  const CROUCH_MS = 190;
  const CROUCH_DIP = 4;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ARC_OUTER_FALLBACK = 34;
  const ARC_KINKS = 7;
  const ARC_WANDER = 0.07;
  const ARC_CENTRE = { x: 22, y: 25 };
  const VIEWBOX_HEIGHT = 50;
  const ARCS_PER_LIMB = 3;
  const ARC_FAN = 15;
  const EXTREMITIES = [
    { limb: ".sk-arm-l", root: { x: 18.5, y: 19.35 }, tip: { x: 11, y: 24.9 } },
    { limb: ".sk-arm-r", root: { x: 28.3, y: 19.05 }, tip: { x: 35.85, y: 11.95 } },
    { limb: ".sk-boot.sk-leg-l", root: { x: 19.35, y: 29.5 }, tip: { x: 17.2, y: 45 } },
    { limb: ".sk-boot.sk-leg-r", root: { x: 24.8, y: 29.5 }, tip: { x: 28.6, y: 44.3 } }
  ];
  const LAUNCH_MS = 1100;
  const LAUNCH_EXIT_MARGIN = 40;
  const HERO_OVER_VILLAIN = 1.1;
  const HERO_FLY_MS = 1500;
  const HERO_STANDOFF = 26;
  const EYE_RATIO = 8.6 / 50;
  const EYE_RATIO_CORNER = 9.4 / 50;
  const MUZZLE_CLEARANCE = 13;
  const LASER_ROUNDS = 3;
  const BEAM_MS = 230;
  const BEAM_GAP = 190;
  const ROUND_GAP = 330;
  const FINISHER_MS = 520;
  const DEFEAT_MS = 1100;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let clicks = 0;
  let departing = false;
  let summoned = false;

  const growth = () => GROWTH_STEP ** Math.min(clicks, GROWTH_CLICKS);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const readSurface = () => {
    const box = planet.getBoundingClientRect();
    const radius = box.width / 2;
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    return {
      heightAt: (x) => centreY - Math.sqrt(Math.max(0, radius ** 2 - (x - centreX) ** 2)),
      angleAt: (x) => (Math.asin(clamp((x - centreX) / radius, -1, 1)) * 180) / Math.PI
    };
  };

  const walkFrames = (surface, startX, targetX, bobCount) => {
    const startY = surface.heightAt(startX);
    return Array.from({ length: WALK_SAMPLES + 1 }, (_, index) => {
      const progress = index / WALK_SAMPLES;
      const x = startX + (targetX - startX) * progress;
      const bob = -BOB_HEIGHT * Math.abs(Math.sin(progress * Math.PI * bobCount));
      const tilt = surface.angleAt(x) * Math.min(1, progress / TILT_BLEND);
      return {
        offset: progress,
        translate: `${(x - startX).toFixed(2)}px ${(surface.heightAt(x) - startY + bob).toFixed(2)}px`,
        rotate: `${tilt.toFixed(2)}deg`,
        easing: "linear"
      };
    });
  };

  const launchFrames = ({ tilt, rise, drift }) => [
    {
      offset: 0,
      translate: `0 ${CROUCH_DIP}px`,
      rotate: `${tilt.toFixed(2)}deg`,
      easing: "cubic-bezier(0.2, 0.85, 0.4, 1)"
    },
    {
      offset: 0.18,
      translate: `${(drift * 0.05).toFixed(2)}px ${(rise * -0.11).toFixed(2)}px`,
      rotate: `${(tilt + 16).toFixed(2)}deg`,
      easing: "cubic-bezier(0.4, 0, 0.75, 0.55)"
    },
    {
      offset: 0.55,
      translate: `${(drift * 0.36).toFixed(2)}px ${(rise * -0.42).toFixed(2)}px`,
      rotate: `${(tilt + 44).toFixed(2)}deg`,
      easing: "cubic-bezier(0.35, 0, 0.65, 1)"
    },
    {
      offset: 1,
      translate: `${drift.toFixed(2)}px ${(-rise).toFixed(2)}px`,
      rotate: `${(tilt + 68).toFixed(2)}deg`
    }
  ];

  const ringInUserUnits = (artwork) => {
    const ring = document.querySelector(".orbit");
    if (!ring) return { centre: ARC_CENTRE, radius: ARC_OUTER_FALLBACK };

    const box = ring.getBoundingClientRect();
    const drawn = artwork.getBoundingClientRect();
    const pxPerUnit = drawn.height / VIEWBOX_HEIGHT;
    if (!pxPerUnit) return { centre: ARC_CENTRE, radius: ARC_OUTER_FALLBACK };

    const centre = {
      x: (box.left + box.width / 2 - drawn.left) / pxPerUnit,
      y: (box.top + box.height / 2 - drawn.top) / pxPerUnit
    };
    const radius = ring.offsetWidth / 2 / pxPerUnit;

    if (!radius) return { centre: ARC_CENTRE, radius: ARC_OUTER_FALLBACK };
    return { centre, radius };
  };

  const posedLimb = (artwork, { limb, root, tip }) => {
    const node = artwork.querySelector(limb);
    if (!node || !artwork.getScreenCTM) return { from: tip, heading: 0 };

    const toViewBox = artwork.getScreenCTM().inverse().multiply(node.getScreenCTM());
    const place = ({ x, y }) => {
      const point = artwork.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(toViewBox);
    };

    const shoulder = place(root);
    const hand = place(tip);
    return {
      from: hand,
      heading: (Math.atan2(hand.y - shoulder.y, hand.x - shoulder.x) * 180) / Math.PI
    };
  };

  const strikeRing = (from, heading, ring) => {
    const radians = (heading * Math.PI) / 180;
    const step = { x: Math.cos(radians), y: Math.sin(radians) };
    const offset = { x: from.x - ring.centre.x, y: from.y - ring.centre.y };
    const along = 2 * (offset.x * step.x + offset.y * step.y);
    const outside = offset.x ** 2 + offset.y ** 2 - ring.radius ** 2;
    const reach = along ** 2 - 4 * outside;

    if (reach < 0) {
      return {
        x: ring.centre.x + step.x * ring.radius,
        y: ring.centre.y + step.y * ring.radius
      };
    }

    const travel = (-along + Math.sqrt(reach)) / 2;
    return { x: from.x + step.x * travel, y: from.y + step.y * travel };
  };

  const arcPoints = (from, to) => {
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const across = { x: -(to.y - from.y) / span, y: (to.x - from.x) / span };
    const spread = span * ARC_WANDER;

    return Array.from({ length: ARC_KINKS + 1 }, (_, step) => {
      const travel = step / ARC_KINKS;
      const edge = step === 0 || step === ARC_KINKS;
      const sideways = edge ? 0 : (Math.random() - 0.5) * 2 * spread;
      const x = from.x + (to.x - from.x) * travel + across.x * sideways;
      const y = from.y + (to.y - from.y) * travel + across.y * sideways;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  };

  const buildArcField = (artwork) => {
    const ring = ringInUserUnits(artwork);
    const field = document.createElementNS(SVG_NS, "g");
    field.setAttribute("class", "sk-arc-field");

    EXTREMITIES.forEach((extremity) => {
      const { from, heading } = posedLimb(artwork, extremity);

      for (let index = 0; index < ARCS_PER_LIMB; index += 1) {
        const fan = ARCS_PER_LIMB === 1 ? 0 : (index / (ARCS_PER_LIMB - 1) - 0.5) * 2 * ARC_FAN;
        const arc = document.createElementNS(SVG_NS, "polyline");
        arc.setAttribute("class", "sk-arc");
        arc.setAttribute("points", arcPoints(from, strikeRing(from, heading + fan, ring)));
        arc.style.animationDuration = `${(5200 + Math.random() * 4000).toFixed(0)}ms`;
        arc.style.animationDelay = `${(1200 + Math.random() * 4200).toFixed(0)}ms`;
        field.append(arc);
      }
    });

    artwork.append(field);
  };

  const land = () => {
    const hero = document.querySelector(".hero");
    if (!hero) {
      sidekick.hidden = true;
      return;
    }

    const artwork = sidekick.querySelector("svg");
    sidekick.getAnimations().forEach((animation) => animation.cancel());
    artwork.getAnimations().forEach((animation) => animation.cancel());
    sidekick.removeAttribute("style");
    sidekick.style.setProperty("--sk-grow", growth().toFixed(6));
    sidekick.classList.remove("is-launching");
    sidekick.classList.add("is-landed");
    sidekick.setAttribute("aria-label", "Send in the other sidekick");
    hero.append(sidekick);
    hero.classList.add("is-charging");
    buildArcField(artwork);

    const champion = document.querySelector(".sidekick-corner");
    if (champion) {
      champion.style.setProperty("--sk-rally", growth().toFixed(6));
      champion.classList.add("is-rallying");
    }
  };

  const summonHero = async () => {
    const champion = document.querySelector(".sidekick-corner");
    const ring = document.querySelector(".orbit");
    const stage = document.querySelector(".hero");
    if (!champion || !ring || !stage) return;

    champion.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch (_) {
        animation.cancel();
      }
    });

    const start = champion.getBoundingClientRect();
    const ringBox = ring.getBoundingClientRect();
    const radius = ring.offsetWidth / 2;
    const ringCentre = {
      x: ringBox.left + ringBox.width / 2,
      y: ringBox.top + ringBox.height / 2
    };

    const size = growth() * HERO_OVER_VILLAIN;
    const base = { width: champion.offsetWidth, height: champion.offsetHeight };
    const rallied = champion.classList.contains("is-rallying") ? growth() : 1;
    const spread = (base.width * size) / 2;
    const from = { x: start.left + start.width / 2, y: start.top + start.height / 2 };
    const shift = {
      x: ringCentre.x - radius - HERO_STANDOFF - spread - from.x,
      y: ringCentre.y - from.y
    };

    document.body.classList.add("is-showdown");
    champion.classList.add("is-summoned");

    if (reducedMotion.matches) {
      champion.style.translate = `${shift.x.toFixed(2)}px ${shift.y.toFixed(2)}px`;
      champion.style.scale = size.toFixed(4);
    } else {
      await champion.animate(
        [
          { translate: "0 0", scale: "1", easing: "cubic-bezier(0.55, 0, 0.3, 1)" },
          {
            offset: 0.28,
            translate: `${(shift.x * 0.14).toFixed(2)}px ${(shift.y * 0.2 - 30).toFixed(2)}px`,
            scale: (rallied + (size - rallied) * 0.28).toFixed(4),
            easing: "cubic-bezier(0.3, 0, 0.2, 1)"
          },
          {
            translate: `${shift.x.toFixed(2)}px ${shift.y.toFixed(2)}px`,
            scale: size.toFixed(4)
          }
        ],
        { duration: HERO_FLY_MS, easing: "linear", fill: "forwards" }
      ).finished;
    }

    const settled = champion.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    champion.getAnimations().forEach((animation) => animation.cancel());
    champion.style.position = "absolute";
    champion.style.left = `${(settled.left + settled.width / 2 - base.width / 2 - stageBox.left).toFixed(2)}px`;
    champion.style.top = `${(settled.top + settled.height / 2 - base.height / 2 - stageBox.top).toFixed(2)}px`;
    champion.style.right = "auto";
    champion.style.bottom = "auto";
    champion.style.translate = "none";
    champion.style.transformOrigin = "50% 50%";
    champion.style.scale = size.toFixed(4);
    stage.append(champion);

    champion.classList.add("is-buff");
    await pause(reducedMotion.matches ? 0 : 620);
    await fight(stage, champion, sidekick);
  };

  const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const eyeLine = (el) => {
    const box = el.getBoundingClientRect();
    const ratio = el.matches(".sidekick-corner") ? EYE_RATIO_CORNER : EYE_RATIO;
    return { x: box.left + box.width / 2, y: box.top + box.height * ratio };
  };

  const fireBeam = async (stage, shooter, target, kind, duration, finisher) => {
    const eye = eyeLine(shooter);
    const to = eyeLine(target);
    const span = Math.hypot(to.x - eye.x, to.y - eye.y) || 1;
    const step = { x: (to.x - eye.x) / span, y: (to.y - eye.y) / span };
    const from = {
      x: eye.x + step.x * MUZZLE_CLEARANCE,
      y: eye.y + step.y * MUZZLE_CLEARANCE
    };
    const stageBox = stage.getBoundingClientRect();
    const reach = Math.hypot(to.x - from.x, to.y - from.y);

    const beam = document.createElement("div");
    beam.className = `sk-beam sk-beam-${kind}${finisher ? " sk-beam-finisher" : ""}`;
    beam.style.left = `${(from.x - stageBox.left).toFixed(2)}px`;
    beam.style.top = `${(from.y - stageBox.top).toFixed(2)}px`;
    beam.style.width = `${reach.toFixed(2)}px`;
    beam.style.rotate = `${((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI).toFixed(2)}deg`;
    stage.append(beam);

    const shot = beam.animate(
      [
        { scale: "0 1", opacity: 1, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
        { offset: 0.3, scale: "1 1", opacity: 1 },
        { offset: 0.62, scale: "1 1.6", opacity: 1 },
        { scale: "1 1", opacity: 0 }
      ],
      { duration, easing: "linear", fill: "forwards" }
    );

    const bruise = `sk-struck-${kind}`;
    await pause(duration * 0.34);
    target.classList.add(bruise);
    await shot.finished.catch(() => {});
    target.classList.remove(bruise);
    beam.remove();
  };

  const fight = async (stage, champion, villain) => {
    if (reducedMotion.matches) {
      await pause(200);
    } else {
      for (let round = 0; round < LASER_ROUNDS; round += 1) {
        await fireBeam(stage, champion, villain, "good", BEAM_MS, false);
        await pause(BEAM_GAP);
        await fireBeam(stage, villain, champion, "evil", BEAM_MS, false);
        await pause(ROUND_GAP);
      }

      await fireBeam(stage, villain, champion, "evil", FINISHER_MS, true);

      const knocked = champion.getBoundingClientRect();
      await champion.animate(
        [
          { translate: "0 0", rotate: "0deg", opacity: 1 },
          { offset: 0.35, translate: `${(-knocked.width * 1.1).toFixed(1)}px 14px`, rotate: "-34deg", opacity: 1 },
          { translate: `${(-knocked.width * 3.4).toFixed(1)}px 210px`, rotate: "-150deg", opacity: 0 }
        ],
        { duration: DEFEAT_MS, easing: "cubic-bezier(0.3, 0, 0.7, 1)", fill: "forwards" }
      ).finished;
    }

    champion.hidden = true;
    document.body.classList.add("is-aftermath");
    document.documentElement.classList.add("is-inferno");

    if (!document.querySelector(".inferno")) {
      const blaze = document.createElement("div");
      blaze.className = "inferno";
      blaze.setAttribute("aria-hidden", "true");
      document.body.append(blaze);
    }
  };

  const fadeOut = async () => {
    await sidekick.animate(
      [
        { translate: "0 0", opacity: 1 },
        { translate: "0 -40px", opacity: 0 }
      ],
      { duration: 300, easing: "ease-out", fill: "forwards" }
    ).finished;
  };

  const depart = async () => {
    const size = growth();

    if (reducedMotion.matches) {
      await fadeOut();
      land();
      return;
    }

    const surface = readSurface();
    const box = sidekick.getBoundingClientRect();
    const startX = box.left + box.width / 2;
    const targetX = EDGE_MARGIN + box.width / 2;
    const distance = Math.max(0, startX - targetX);
    const duration = Math.max(600, (distance / WALK_SPEED) * 1000);
    const bobCount = Math.max(2, Math.round((2 * duration) / WALK_STEP_MS));

    sidekick.style.setProperty("--sk-step", `${((2 * duration) / bobCount).toFixed(0)}ms`);
    sidekick.classList.add("is-walking");

    const walk = sidekick.animate(walkFrames(surface, startX, targetX, bobCount), {
      duration,
      easing: "linear",
      fill: "forwards"
    });
    await walk.finished;

    sidekick.classList.remove("is-walking");

    const tilt = surface.angleAt(targetX);
    const drop = surface.heightAt(targetX) - surface.heightAt(startX);

    walk.cancel();
    const rest = sidekick.getBoundingClientRect();
    const boxWidth = rest.width / size;
    const boxHeight = rest.height / size;

    sidekick.style.position = "fixed";
    sidekick.style.left = `${(targetX - boxWidth / 2).toFixed(2)}px`;
    sidekick.style.top = `${(rest.bottom - boxHeight + drop).toFixed(2)}px`;
    sidekick.style.right = "auto";
    sidekick.style.bottom = "auto";
    sidekick.style.rotate = `${tilt.toFixed(2)}deg`;

    const perch = sidekick.getBoundingClientRect();
    const beacon = document.querySelector(".orbit");
    const beaconBox = beacon ? beacon.getBoundingClientRect() : null;
    const cornerX = beaconBox
      ? beaconBox.left + beaconBox.width / 2
      : window.innerWidth - EDGE_MARGIN;
    const rise = perch.top + perch.height + LAUNCH_EXIT_MARGIN;
    const drift = cornerX - (perch.left + perch.width / 2);

    sidekick.classList.add("is-launching");
    const artwork = sidekick.querySelector("svg");
    artwork.animate([{ scale: "-1 1" }, { scale: "1 1" }], {
      duration: CROUCH_MS,
      easing: "ease-in-out",
      fill: "forwards"
    });

    await sidekick.animate(
      [
        { translate: "0 0" },
        { translate: `0 ${CROUCH_DIP}px` }
      ],
      { duration: CROUCH_MS, easing: "ease-out", fill: "forwards" }
    ).finished;

    await sidekick.animate(launchFrames({ tilt, rise, drift }), {
      duration: LAUNCH_MS,
      easing: "linear",
      fill: "forwards"
    }).finished;

    land();
  };

  sidekick.addEventListener("click", () => {
    if (sidekick.classList.contains("is-landed")) {
      if (summoned) return;
      summoned = true;
      summonHero().catch(() => {
        summoned = false;
      });
      return;
    }

    if (departing) return;
    clicks += 1;

    if (clicks <= GROWTH_CLICKS) {
      sidekick.style.setProperty("--sk-grow", growth().toFixed(6));
      return;
    }

    departing = true;
    depart().catch(() => {
      departing = false;
    });
  });
})();
