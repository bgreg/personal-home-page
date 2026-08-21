(() => {
  "use strict";

  const sidekick = document.querySelector(".sidekick-atmo");
  const planet = document.querySelector(".planet");
  if (!sidekick || !planet) return;

  const GROWTH_CLICKS = 3;
  const GROWTH_STEP = 1.05;
  const WALK_SPEED = 220;
  const WALK_STEP_MS = 460;
  const WALK_SAMPLES = 60;
  const TILT_BLEND = 0.18;
  const BOB_HEIGHT = 2.5;
  const EDGE_MARGIN = 56;
  const CROUCH_MS = 190;
  const LAUNCH_MS = 950;
  const LAUNCH_CLEARANCE = 140;
  const LAUNCH_DRIFT = 110;
  const RETURN_AFTER_MS = null;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let clicks = 0;
  let departing = false;

  const growth = () => GROWTH_STEP ** Math.min(clicks, GROWTH_CLICKS);
  const scaleValue = (x, y) => `${x.toFixed(4)} ${y.toFixed(4)}`;
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

  const launchFrames = ({ tilt, size, rise, drift }) => [
    {
      offset: 0,
      translate: "0 0",
      rotate: `${tilt.toFixed(2)}deg`,
      scale: scaleValue(size * 1.06, size * 0.76),
      opacity: 1,
      easing: "cubic-bezier(0.2, 0.85, 0.4, 1)"
    },
    {
      offset: 0.18,
      translate: `${(drift * -0.04).toFixed(2)}px ${(rise * -0.09).toFixed(2)}px`,
      rotate: `${(tilt - 18).toFixed(2)}deg`,
      scale: scaleValue(size * 0.94, size * 1.14),
      opacity: 1,
      easing: "cubic-bezier(0.4, 0, 0.75, 0.55)"
    },
    {
      offset: 0.55,
      translate: `${(drift * -0.34).toFixed(2)}px ${(rise * -0.36).toFixed(2)}px`,
      rotate: `${(tilt - 34).toFixed(2)}deg`,
      scale: scaleValue(size, size),
      opacity: 1,
      easing: "cubic-bezier(0.35, 0, 0.65, 1)"
    },
    {
      offset: 1,
      translate: `${(-drift).toFixed(2)}px ${(-rise).toFixed(2)}px`,
      rotate: `${(tilt - 46).toFixed(2)}deg`,
      scale: scaleValue(size * 0.45, size * 0.45),
      opacity: 0
    }
  ];

  const scheduleReturn = () => {
    if (typeof RETURN_AFTER_MS !== "number") return;
    window.setTimeout(() => {
      sidekick.getAnimations().forEach((animation) => animation.cancel());
      sidekick.removeAttribute("style");
      sidekick.hidden = false;
      clicks = 0;
      departing = false;
      sidekick.animate(
        [
          { translate: `${-LAUNCH_DRIFT}px -520px`, opacity: 0 },
          { translate: "0 0", opacity: 1 }
        ],
        { duration: 800, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }
      );
    }, RETURN_AFTER_MS);
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
      sidekick.hidden = true;
      scheduleReturn();
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

    const rise = sidekick.getBoundingClientRect().top + LAUNCH_CLEARANCE;

    await sidekick.animate(
      [
        { scale: scaleValue(size, size) },
        { scale: scaleValue(size * 1.06, size * 0.76) }
      ],
      { duration: CROUCH_MS, easing: "ease-out", fill: "forwards" }
    ).finished;

    await sidekick.animate(launchFrames({ tilt, size, rise, drift: LAUNCH_DRIFT }), {
      duration: LAUNCH_MS,
      easing: "linear",
      fill: "forwards"
    }).finished;

    sidekick.hidden = true;
    scheduleReturn();
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
