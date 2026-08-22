(() => {
  "use strict";

  const sidekick = document.querySelector(".sidekick-atmo");
  const champion = document.querySelector(".sidekick-corner");
  const championHome = champion && {
    parent: champion.parentElement,
    next: champion.nextElementSibling
  };
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
  const BLAST_CENTRE = { x: 22, y: 22 };
  const HERO_HOME_MS = 1150;
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
  const EYE_HEIGHT = { atmo: 8.85, corner: 9.4 };
  const MUZZLE_CLEARANCE = 13;
  const LASER_ROUNDS = 3;
  const WRECK_BURST_MS = 460;
  const WRECK_FALL_MS = 2600;
  const WRECK_STAGGER = 26;
  const WRECK_PIECES = [
    { sel: ".sk-cape-l", pivot: { x: 12, y: 28 }, to: { x: 9.4, y: 43.2 }, spin: 104 },
    { sel: ".sk-cape-r", pivot: { x: 30, y: 25 }, to: { x: 35.4, y: 43.6 }, spin: -98 },
    { sel: ".sk-tunic, .sk-ridge:not(.sk-gorget), .sk-seg, .sk-belt, .sk-emblem", pivot: { x: 22, y: 22.6 }, to: { x: 22.4, y: 43.4 }, spin: 86 },
    { sel: ".sk-arm-l", pivot: { x: 15, y: 22 }, to: { x: 9.6, y: 46.4 }, spin: 72 },
    { sel: ".sk-arm-r", pivot: { x: 32, y: 15 }, to: { x: 34.4, y: 46.6 }, spin: -116 },
    { sel: ".sk-leg-l", pivot: { x: 17.5, y: 36 }, to: { x: 14.2, y: 47.6 }, spin: 102 },
    { sel: ".sk-leg-r", pivot: { x: 27, y: 36 }, to: { x: 28.8, y: 47.8 }, spin: -82 },
    { sel: ".sk-skin, .sk-mask, .sk-jaw, .sk-gorget, .sk-eye", pivot: { x: 22, y: 9 }, to: { x: 20.4, y: 38.6 }, spin: 22 }
  ];
  const BEAM_MS = 230;
  const BEAM_GAP = 190;
  const ROUND_GAP = 330;
  const FINISHER_MS = 520;
  const DEFEAT_MS = 1100;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let clicks = 0;
  let departing = false;
  let summoned = false;

  const grownScale = () => GROWTH_STEP ** Math.min(clicks, GROWTH_CLICKS);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const readPlanetSurface = () => {
    const box = planet.getBoundingClientRect();
    const radius = box.width / 2;
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    return {
      heightAt: (x) => centreY - Math.sqrt(Math.max(0, radius ** 2 - (x - centreX) ** 2)),
      angleAt: (x) => (Math.asin(clamp((x - centreX) / radius, -1, 1)) * 180) / Math.PI
    };
  };

  const walkAlongSurfaceFrames = (surface, startX, targetX, bobCount) => {
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

  const launchArcFrames = ({ tilt, rise, drift }) => [
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

  const orbitRingInUserUnits = (artwork) => {
    const ring = document.querySelector(".orbit");
    if (!ring) return { centre: ARC_CENTRE, radius: ARC_OUTER_FALLBACK };

    const box = ring.getBoundingClientRect();
    const drawn = artwork.getBoundingClientRect();
    const perUnit = pxPerUnit(artwork);

    const centre = {
      x: (box.left + box.width / 2 - drawn.left) / perUnit,
      y: (box.top + box.height / 2 - drawn.top) / perUnit
    };
    const radius = ring.offsetWidth / 2 / perUnit;

    if (!radius) return { centre: ARC_CENTRE, radius: ARC_OUTER_FALLBACK };
    return { centre, radius };
  };

  const bodyParts = (artwork) => [...artwork.querySelectorAll("g > *")];

  const pxPerUnit = (artwork) =>
    artwork.getBoundingClientRect().height / VIEWBOX_HEIGHT || 1;

  const pinToCentre = (part) => {
    const box = part.getBBox();
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    part.style.transformBox = "view-box";
    part.style.transformOrigin = `${centre.x}px ${centre.y}px`;
    return centre;
  };

  const aimAlongPosedLimb = (artwork, { limb, root, tip }) => {
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

  const whereBoltMeetsRing = (from, heading, ring) => {
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

  const jaggedBoltPoints = (from, to) => {
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

  const drawLightningToTheRing = (artwork) => {
    const ring = orbitRingInUserUnits(artwork);
    const field = document.createElementNS(SVG_NS, "g");
    field.setAttribute("class", "sk-arc-field");

    EXTREMITIES.forEach((extremity) => {
      const { from, heading } = aimAlongPosedLimb(artwork, extremity);

      for (let index = 0; index < ARCS_PER_LIMB; index += 1) {
        const fan = ARCS_PER_LIMB === 1 ? 0 : (index / (ARCS_PER_LIMB - 1) - 0.5) * 2 * ARC_FAN;
        const arc = document.createElementNS(SVG_NS, "polyline");
        arc.setAttribute("class", "sk-arc");
        arc.setAttribute("points", jaggedBoltPoints(from, whereBoltMeetsRing(from, heading + fan, ring)));
        arc.style.animationDuration = `${(5200 + Math.random() * 4000).toFixed(0)}ms`;
        arc.style.animationDelay = `${(1200 + Math.random() * 4200).toFixed(0)}ms`;
        field.append(arc);
      }
    });

    artwork.append(field);
  };

  const arriveInTheOrbitRing = () => {
    const hero = document.querySelector(".hero");
    if (!hero) {
      sidekick.hidden = true;
      return;
    }

    const artwork = sidekick.querySelector("svg");
    sidekick.getAnimations().forEach((animation) => animation.cancel());
    artwork.getAnimations().forEach((animation) => animation.cancel());
    sidekick.removeAttribute("style");
    sidekick.style.setProperty("--sk-grow", grownScale().toFixed(6));
    sidekick.classList.remove("is-launching");
    sidekick.classList.add("is-landed");
    sidekick.setAttribute("aria-label", "Send in the other sidekick");
    hero.append(sidekick);
    hero.classList.add("is-charging");
    if (reducedMotion.matches) sidekick.classList.add("is-static-charge");
    drawLightningToTheRing(artwork);

    if (champion) {
      champion.style.setProperty("--sk-rally", grownScale().toFixed(6));
      champion.classList.add("is-rallying");
    }
  };

  const sendTheHeroToTheStandoff = async (heroWins) => {
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

    const size = grownScale() * HERO_OVER_VILLAIN;
    const base = { width: champion.offsetWidth, height: champion.offsetHeight };
    const rallied = champion.classList.contains("is-rallying") ? grownScale() : 1;
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
    await exchangeLaserFire(stage, heroWins);
  };

  const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const eyePosition = (el) => {
    const box = el.getBoundingClientRect();
    const eyeY = el.matches(".sidekick-corner") ? EYE_HEIGHT.corner : EYE_HEIGHT.atmo;
    return { x: box.left + box.width / 2, y: box.top + (box.height * eyeY) / VIEWBOX_HEIGHT };
  };

  const fireLaserBeam = async (stage, shooter, target, kind, duration, finisher) => {
    const eye = eyePosition(shooter);
    const to = eyePosition(target);
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

  const poseTheWreckage = (artwork) => {
    const claimed = new Set();

    WRECK_PIECES.forEach(({ sel, pivot, to, spin }) => {
      artwork.querySelectorAll(sel).forEach((part) => {
        claimed.add(part);
        part.style.transformBox = "view-box";
        part.style.transformOrigin = `${pivot.x}px ${pivot.y}px`;
        part.style.translate = `${(to.x - pivot.x).toFixed(2)}px ${(to.y - pivot.y).toFixed(2)}px`;
        part.style.rotate = `${spin}deg`;
      });
    });

    let loose = 0;

    bodyParts(artwork).forEach((part) => {
      if (claimed.has(part)) return;
      const { x: cx, y: cy } = pinToCentre(part);
      const lean = loose % 2 === 0 ? 1 : -1;
      const restX = 12.8 + (loose % 5) * 4.5;
      const restY = 45.4 + (loose % 3) * 0.9;
      part.style.translate = `${(restX - cx).toFixed(2)}px ${(restY - cy).toFixed(2)}px`;
      part.style.rotate = `${lean * (36 + loose * 23)}deg`;
      loose += 1;
    });
  };

  const restTheWreckageInTheFooter = () => {
    const footer = document.querySelector("footer");
    const source = sidekick.querySelector("svg");
    if (!footer || !source || document.querySelector(".sidekick-wreck")) return;

    const wreck = document.createElement("div");
    wreck.className = "sidekick-wreck";
    wreck.setAttribute("aria-hidden", "true");
    wreck.style.setProperty("--sk-grow", grownScale().toFixed(6));

    const artwork = source.cloneNode(true);
    artwork.removeAttribute("role");
    artwork.querySelectorAll(".sk-arc-field").forEach((field) => field.remove());

    wreck.append(artwork);
    footer.append(wreck);
    poseTheWreckage(artwork);
  };

  const returnTheHeroToHerCorner = async () => {
    if (!champion || !championHome) return;

    const from = champion.getBoundingClientRect();

    champion.getAnimations().forEach((animation) => animation.cancel());
    champion.classList.remove("is-summoned", "is-buff", "is-rallying");
    champion.removeAttribute("style");
    championHome.parent.insertBefore(champion, championHome.next);

    const home = champion.getBoundingClientRect();
    if (!home.width || reducedMotion.matches) return;

    const shift = {
      x: from.left + from.width / 2 - (home.left + home.width / 2),
      y: from.top + from.height / 2 - (home.top + home.height / 2)
    };

    await champion.animate(
      [
        {
          translate: `${shift.x.toFixed(2)}px ${shift.y.toFixed(2)}px`,
          scale: (from.width / home.width).toFixed(4),
          easing: "cubic-bezier(0.5, 0, 0.2, 1)"
        },
        { translate: "0 0", scale: "1" }
      ],
      { duration: HERO_HOME_MS }
    ).finished;
  };

  const destroyTheVillain = async (stage) => {
    const artwork = sidekick.querySelector("svg");

    if (!reducedMotion.matches && artwork) {
      await fireLaserBeam(stage, champion, sidekick, "good", FINISHER_MS, true);

      artwork.querySelectorAll(".sk-arc-field").forEach((field) => field.remove());

      const artworkBox = artwork.getBoundingClientRect();
      const drop = (stage.getBoundingClientRect().bottom - artworkBox.top) / pxPerUnit(artwork) + 60;
      const parts = bodyParts(artwork);
      const centres = parts.map(pinToCentre);

      await Promise.all(
        parts.map((part, index) => {
          const { x: cx, y: cy } = centres[index];
          const away = { x: cx - BLAST_CENTRE.x, y: cy - BLAST_CENTRE.y };
          const span = Math.hypot(away.x, away.y) || 1;
          const kick = 9 + Math.random() * 10;
          const spin = (Math.random() - 0.5) * 940;
          const sway = (Math.random() - 0.5) * 28;
          const burst = {
            x: (away.x / span) * kick,
            y: (away.y / span) * kick - 7
          };

          return part.animate(
            [
              {
                translate: "0 0",
                rotate: "0deg",
                opacity: 1,
                easing: "cubic-bezier(0.05, 0.8, 0.3, 1)"
              },
              {
                offset: WRECK_BURST_MS / (WRECK_BURST_MS + WRECK_FALL_MS),
                translate: `${burst.x.toFixed(2)}px ${burst.y.toFixed(2)}px`,
                rotate: `${(spin * 0.17).toFixed(1)}deg`,
                opacity: 1,
                easing: "cubic-bezier(0.42, 0, 0.9, 0.72)"
              },
              {
                translate: `${(burst.x + sway).toFixed(2)}px ${drop.toFixed(2)}px`,
                rotate: `${spin.toFixed(1)}deg`,
                opacity: 0
              }
            ],
            {
              duration: WRECK_BURST_MS + WRECK_FALL_MS,
              delay: index * WRECK_STAGGER,
              easing: "linear",
              fill: "forwards"
            }
          ).finished;
        })
      );
    }

    sidekick.hidden = true;
    stage.classList.remove("is-charging");
    document.body.classList.remove("is-showdown");
    document.body.classList.add("is-victory");
    restTheWreckageInTheFooter();
    await returnTheHeroToHerCorner();
  };

  const defeatTheHero = async (stage) => {
    if (!reducedMotion.matches) {
      await fireLaserBeam(stage, sidekick, champion, "evil", FINISHER_MS, true);

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
    burnThePageDown();
  };

  const burnThePageDown = () => {
    document.body.classList.add("is-aftermath");
    document.documentElement.classList.add("is-inferno");

    if (document.querySelector(".inferno")) return;

    const blaze = document.createElement("div");
    blaze.className = "inferno";
    blaze.setAttribute("aria-hidden", "true");
    document.body.append(blaze);
  };

  const exchangeLaserFire = async (stage, heroWins) => {
    if (reducedMotion.matches) {
      await pause(200);
    } else {
      for (let round = 0; round < LASER_ROUNDS; round += 1) {
        await fireLaserBeam(stage, champion, sidekick, "good", BEAM_MS, false);
        await pause(BEAM_GAP);
        await fireLaserBeam(stage, sidekick, champion, "evil", BEAM_MS, false);
        await pause(ROUND_GAP);
      }
    }

    await (heroWins ? destroyTheVillain : defeatTheHero)(stage);
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

  const walkTheArcAndLaunch = async () => {
    const size = grownScale();

    if (reducedMotion.matches) {
      await fadeOut();
      arriveInTheOrbitRing();
      return;
    }

    const surface = readPlanetSurface();
    const box = sidekick.getBoundingClientRect();
    const startX = box.left + box.width / 2;
    const targetX = EDGE_MARGIN + box.width / 2;
    const distance = Math.max(0, startX - targetX);
    const duration = Math.max(600, (distance / WALK_SPEED) * 1000);
    const bobCount = Math.max(2, Math.round((2 * duration) / WALK_STEP_MS));

    sidekick.style.setProperty("--sk-step", `${((2 * duration) / bobCount).toFixed(0)}ms`);
    sidekick.classList.add("is-walking");

    const walk = sidekick.animate(walkAlongSurfaceFrames(surface, startX, targetX, bobCount), {
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

    document.dispatchEvent(new CustomEvent("holyclicks:disable"));
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

    await sidekick.animate(launchArcFrames({ tilt, rise, drift }), {
      duration: LAUNCH_MS,
      easing: "linear",
      fill: "forwards"
    }).finished;

    arriveInTheOrbitRing();
  };

  const beginTheShowdown = (heroWins) => {
    if (summoned) return;
    summoned = true;
    sendTheHeroToTheStandoff(heroWins).catch(() => {
      summoned = false;
    });
  };

  if (champion) {
    champion.addEventListener("click", () => {
      if (!champion.classList.contains("is-rallying")) return;
      beginTheShowdown(true);
    });
  }

  sidekick.addEventListener("click", () => {
    if (sidekick.classList.contains("is-landed")) {
      beginTheShowdown(false);
      return;
    }

    if (departing) return;
    clicks += 1;

    if (clicks <= GROWTH_CLICKS) {
      sidekick.style.setProperty("--sk-grow", grownScale().toFixed(6));
      return;
    }

    departing = true;
    walkTheArcAndLaunch().catch(() => {
      departing = false;
    });
  });
})();
