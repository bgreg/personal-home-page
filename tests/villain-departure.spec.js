import {
  test,
  expect,
  openSite,
  clickVillain,
  readLog,
  growthClicksUntilHeLeaves,
  waitForMarker,
  waitForArcs,
  SELECTORS,
  MARKERS,
  TOKENS
} from "./support/battle.js";

const NARROW_VIEWPORT = { width: 1100, height: 900 };
const WIDE_VIEWPORT = { width: 1600, height: 900 };
const MAX_PACE_DRIFT = 0.01;
const MAX_EDGE_FRACTION = 0.12;
const MAX_BOB_FRACTION = 0.2;
const FRAME_TOLERANCE_PX = 0.02;
const MIN_READABLE_TILT = 5;
const BLEND_TOLERANCE = 0.005;

const readPlanet = (page) =>
  page.evaluate((selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }, SELECTORS.planet);

const surfaceModel = (planet) => {
  const radius = planet.width / 2;
  const centre = { x: planet.left + planet.width / 2, y: planet.top + planet.height / 2 };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  return {
    heightAt: (x) => centre.y - Math.sqrt(Math.max(0, radius ** 2 - (x - centre.x) ** 2)),
    angleAt: (x) => (Math.asin(clamp((x - centre.x) / radius, -1, 1)) * 180) / Math.PI
  };
};

const walkCall = (log) =>
  log.animations.find(
    (call) => call.name.includes("villain") && call.frames && call.frames.length > 10
  );

const crouchCall = (log) =>
  log.animations.find(
    (call) =>
      call.name.includes("villain") &&
      call.frames &&
      call.frames.length === 2 &&
      call.frames[1].translate
  );

const launchCall = (log) =>
  log.animations.find(
    (call) => call.name.includes("villain") && call.frames && call.frames.length === 4
  );

const shiftOf = (frame) => frame.translate.split(" ").map(parseFloat);

const walkMeasurements = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await openSite(page);
  const planet = await readPlanet(page);
  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.walking);

  const log = await readLog(page);
  const walk = walkCall(log);
  const step = await page.evaluate(
    (contract) => document.querySelector(contract.villain).style.getPropertyValue(contract.step),
    { villain: SELECTORS.villain, step: TOKENS.step }
  );

  return { planet, walk, step };
};

test("his growth is geometric and stops before he leaves", async ({ page }) => {
  await openSite(page);

  const before = await page.evaluate(
    (selector) => document.querySelector(selector).getAttribute("style"),
    SELECTORS.villain
  );
  expect(before, "he starts at his natural size").toBeNull();

  const { sizes, clicksTaken } = await growthClicksUntilHeLeaves(page);

  expect(sizes.length, "he should grow more than once before he walks").toBeGreaterThan(1);
  expect(clicksTaken, "the click after his last growth sends him walking").toBe(sizes.length + 1);

  const ratios = sizes.slice(1).map((size, index) => size / sizes[index]);
  ratios.forEach((ratio, index) => {
    expect(ratio, `click ${index + 2} should compound by the same ratio`).toBeCloseTo(
      sizes[0],
      6
    );
  });
  expect(sizes[0], "each click should make him bigger").toBeGreaterThan(1);
  expect(sizes[sizes.length - 1]).toBeCloseTo(sizes[0] ** sizes.length, 6);

  await expect(page.locator(SELECTORS.villain)).toHaveCSS("scale", String(sizes[sizes.length - 1]));
});

test("he keeps his final size through the walk, the launch, and the landing", async ({ page }) => {
  test.setTimeout(90_000);

  await openSite(page);
  const { sizes } = await growthClicksUntilHeLeaves(page);
  const grown = sizes[sizes.length - 1];

  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);

  const landed = await page.evaluate(
    (contract) => document.querySelector(contract.villain).style.getPropertyValue(contract.grow),
    { villain: SELECTORS.villain, grow: TOKENS.grow }
  );

  expect(Number(landed), "he should land at the size he grew to").toBeCloseTo(grown, 6);
});

test("he walks the planet arc to the left corner", async ({ page }) => {
  const { planet, walk, step } = await walkMeasurements(page, WIDE_VIEWPORT);

  expect(walk, "the last click should schedule one walk animation").toBeTruthy();
  expect(walk.options.easing).toBe("linear");
  expect(walk.options.fill).toBe("forwards");

  const offsets = walk.frames.map((frame) => frame.offset);
  expect(offsets[0]).toBe(0);
  expect(offsets[offsets.length - 1]).toBe(1);
  offsets.forEach((offset, index) => {
    expect(offset, "the walk should be sampled evenly").toBeCloseTo(
      index / (offsets.length - 1),
      6
    );
  });
  expect(walk.frames.every((frame) => frame.easing === "linear")).toBe(true);

  const surface = surfaceModel(planet);
  const startX = walk.rect.left + walk.rect.width / 2;
  const travel = shiftOf(walk.frames[walk.frames.length - 1])[0];
  const targetX = startX + travel;
  const startY = surface.heightAt(startX);
  const windowWidth = await page.evaluate(() => globalThis.innerWidth);

  expect(travel, "he should walk to the left").toBeLessThan(0);
  expect(
    walk.rect.left + travel,
    "he should finish tucked into the left corner of the window"
  ).toBeLessThan(windowWidth * MAX_EDGE_FRACTION);
  expect(walk.rect.left + travel, "he should stay on screen").toBeGreaterThan(0);

  expect(shiftOf(walk.frames[0])).toEqual([0, 0]);
  expect(parseFloat(walk.frames[0].rotate)).toBe(0);

  const bobCount = Math.round((2 * walk.options.duration) / parseFloat(step));
  expect(bobCount, "the step timing should divide the walk into whole strides").toBeGreaterThan(1);

  const bobs = walk.frames.map((frame, index) => {
    const progress = index / (walk.frames.length - 1);
    const x = startX + (targetX - startX) * progress;
    return {
      progress,
      x,
      measured: shiftOf(frame)[1] - (surface.heightAt(x) - startY),
      shape: -Math.abs(Math.sin(progress * Math.PI * bobCount))
    };
  });

  const amplitude =
    bobs.reduce((total, bob) => total + bob.measured * bob.shape, 0) /
    bobs.reduce((total, bob) => total + bob.shape * bob.shape, 0);

  expect(amplitude, "he should bob as he walks").toBeGreaterThan(0);
  expect(
    amplitude,
    "the bob should be a small fraction of his height"
  ).toBeLessThan(walk.rect.height * MAX_BOB_FRACTION);

  bobs.forEach((bob, index) => {
    expect(
      Math.abs(bob.measured - amplitude * bob.shape),
      `frame ${index} should ride the planet surface with one clean stride`
    ).toBeLessThan(FRAME_TOLERANCE_PX + 0.01);
  });

  bobs.forEach((bob, index) => {
    expect(
      shiftOf(walk.frames[index])[0],
      `frame ${index} should track the walk evenly`
    ).toBeCloseTo(bob.x - startX, 1);
  });
});

test("his lean blends in from upright and then follows the surface exactly", async ({ page }) => {
  const { planet, walk } = await walkMeasurements(page, WIDE_VIEWPORT);

  const surface = surfaceModel(planet);
  const startX = walk.rect.left + walk.rect.width / 2;
  const travel = shiftOf(walk.frames[walk.frames.length - 1])[0];

  const blends = walk.frames
    .map((frame, index) => {
      const progress = index / (walk.frames.length - 1);
      const tangent = surface.angleAt(startX + travel * progress);
      return { index, tangent, blend: parseFloat(frame.rotate) / tangent };
    })
    .filter((sample) => Math.abs(sample.tangent) > MIN_READABLE_TILT);

  expect(blends[0].blend, "he should start upright").toBeCloseTo(0, 2);
  expect(
    blends[blends.length - 1].blend,
    "he should end leaning exactly with the surface"
  ).toBeCloseTo(1, 2);

  blends.forEach((sample, index) => {
    if (index === 0) return;
    expect(
      sample.blend,
      `the lean should never fall back at frame ${sample.index}`
    ).toBeGreaterThanOrEqual(blends[index - 1].blend - BLEND_TOLERANCE);
    expect(sample.blend, "the lean should never overshoot the surface").toBeLessThanOrEqual(
      1 + BLEND_TOLERANCE
    );
  });
});

test("he walks at a constant pace no matter how far he has to go", async ({ page }) => {
  const near = await walkMeasurements(page, NARROW_VIEWPORT);
  const far = await walkMeasurements(page, WIDE_VIEWPORT);

  const paceOf = (measurement) =>
    Math.abs(shiftOf(measurement.walk.frames[measurement.walk.frames.length - 1])[0]) /
    measurement.walk.options.duration;

  expect(
    Math.abs(shiftOf(far.walk.frames[far.walk.frames.length - 1])[0]),
    "the wider window should give him further to walk"
  ).toBeGreaterThan(Math.abs(shiftOf(near.walk.frames[near.walk.frames.length - 1])[0]) + 50);

  expect(
    Math.abs(paceOf(far) - paceOf(near)) / paceOf(near),
    "his pace should not depend on the distance"
  ).toBeLessThan(MAX_PACE_DRIFT);
});

test("he takes off toward the orbit ring's horizontal centre and clears the top", async ({
  page
}) => {
  test.setTimeout(90_000);

  await openSite(page);

  const ringCentreX = await page.evaluate((selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return box.left + box.width / 2;
  }, SELECTORS.ring);

  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.launching);
  await page.waitForFunction(
    () => window.__log.animations.some((call) => call.frames && call.frames.length === 4),
    null,
    { timeout: 20_000 }
  );

  const log = await readLog(page);
  const crouch = crouchCall(log);
  const launch = launchCall(log);

  expect(crouch, "he should crouch before he jumps").toBeTruthy();
  expect(launch, "the crouch should be followed by a launch arc").toBeTruthy();

  const dip = shiftOf(crouch.frames[1])[1];
  expect(dip, "the crouch should dip him downward").toBeGreaterThan(0);
  expect(dip, "the crouch should be a small dip, not a fall").toBeLessThan(launch.rect.height / 4);

  const offsets = launch.frames.map((frame) => frame.offset);
  expect(offsets[0]).toBe(0);
  expect(offsets[offsets.length - 1]).toBe(1);
  offsets.slice(1, -1).forEach((offset, index) => {
    expect(offset, "the arc should be ordered").toBeGreaterThan(offsets[index]);
  });

  const [driftX, riseY] = shiftOf(launch.frames[3]);
  const perchCentreX = launch.rect.left + launch.rect.width / 2;

  expect(driftX, "he should aim at the horizontal centre of the orbit ring").toBeCloseTo(
    ringCentreX - perchCentreX,
    1
  );
  expect(riseY, "he should travel upward").toBeLessThan(0);

  const exitTop = launch.rect.top + launch.rect.height + riseY - dip;
  expect(exitTop, "he should end fully above the top of the window").toBeLessThan(0);
  expect(exitTop, "he should not be flung absurdly far").toBeGreaterThan(-launch.rect.height);

  const spin = launch.frames.map((frame) => parseFloat(frame.rotate));
  spin.slice(1).forEach((angle, index) => {
    expect(angle, "he should tumble one way through the whole arc").toBeGreaterThan(spin[index]);
  });
});

test("clicking him again while he walks does not start a second departure", async ({ page }) => {
  test.setTimeout(90_000);

  await openSite(page);
  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.walking);

  await clickVillain(page, 4);

  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);
  await waitForArcs(page);

  const log = await readLog(page);
  const walks = log.animations.filter(
    (call) => call.name.includes("villain") && call.frames && call.frames.length > 10
  );

  expect(walks, "only one walk should ever be scheduled").toHaveLength(1);
  expect(log.arcFields, "he should arrive once and charge once").toBe(1);
});

test("the page rides up with him so the ring is on screen when he lands", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);
  await page.evaluate(
    (selector) => document.querySelector(selector).scrollIntoView({ block: "end" }),
    SELECTORS.footer
  );
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(500);

  const downAtHisFeet = await page.evaluate(() => Math.round(window.scrollY));

  const { clicksTaken } = await growthClicksUntilHeLeaves(page);
  expect(clicksTaken, "a handful of clicks should send him on his way").toBeTruthy();
  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);

  const afterTheFlight = await page.evaluate(() => Math.round(window.scrollY));

  expect(
    afterTheFlight,
    "the flight should have carried the reader back to the top"
  ).toBeLessThan(downAtHisFeet);

  expect(
    await page.evaluate((selector) => {
      const ring = document.querySelector(selector).getBoundingClientRect();
      return ring.bottom > 0 && ring.top < window.innerHeight;
    }, SELECTORS.ring),
    "the ring he lands in should be on screen, or nobody sees what happens next"
  ).toBe(true);
});
