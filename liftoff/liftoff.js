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
  const LAUNCH_MS = 1100;
  const LAUNCH_CLEARANCE = 140;
  const LAUNCH_OVERSHOOT = 220;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let clicks = 0;
  let departing = false;

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

  const land = () => {
    const hero = document.querySelector(".hero");
    if (!hero) {
      sidekick.hidden = true;
      return;
    }

    sidekick.getAnimations().forEach((animation) => animation.cancel());
    sidekick.querySelector("svg").getAnimations().forEach((animation) => animation.cancel());
    sidekick.removeAttribute("style");
    sidekick.style.setProperty("--sk-grow", growth().toFixed(6));
    sidekick.classList.remove("is-launching");
    sidekick.classList.add("is-landed");
    sidekick.setAttribute("aria-hidden", "true");
    sidekick.inert = true;
    hero.append(sidekick);
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
    const rise = perch.top + LAUNCH_CLEARANCE;
    const drift = window.innerWidth - perch.left + LAUNCH_OVERSHOOT;

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
