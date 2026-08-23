import {
  test,
  expect,
  openSite,
  clickVillain,
  driveToLanded,
  waitForMarker,
  waitForArcs,
  readLog,
  readRingAndVillain,
  readArcs,
  groupArcsByOrigin,
  rednessOf,
  turnBetween,
  bearing,
  SELECTORS,
  MARKERS,
  TOKENS
} from "./support/battle.js";

const RING_TOLERANCE_PX = 1;
const CIRCUMFERENCE_TOLERANCE_PX = 0.1;
const FAN_TOLERANCE_DEGREES = 0.1;
const MAX_WANDER_FRACTION = 0.25;
const ALONG_BOLT_TOLERANCE = 0.02;
const MIN_CHARGE_PAUSE_MS = 500;
const MIN_LIMB_SEPARATION = 3;

const readFill = (page, selector) =>
  page.evaluate((target) => getComputedStyle(document.querySelector(target)).fill, selector);

const readDisplay = (page, selector) =>
  page.evaluate((target) => getComputedStyle(document.querySelector(target)).display, selector);

const readRotate = (page, selector) =>
  page.evaluate((target) => getComputedStyle(document.querySelector(target)).rotate, selector);

const readDotColour = (page) =>
  page.evaluate(
    (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor,
    SELECTORS.ringDot
  );

test("he lands within a pixel of the true centre of the orbit ring", async ({ page }) => {
  await driveToLanded(page);

  const { ringCentre, ringRadius, ringSpunWidth, villainCentre } = await readRingAndVillain(page);

  expect(ringRadius, "the ring should have a real radius").toBeGreaterThan(0);
  expect(
    ringSpunWidth,
    "the spinning ring's client rect is wider than the ring itself"
  ).toBeGreaterThanOrEqual(ringRadius * 2 - RING_TOLERANCE_PX);

  expect(
    Math.abs(villainCentre.x - ringCentre.x),
    "he should stand on the ring's vertical axis"
  ).toBeLessThan(RING_TOLERANCE_PX);
  expect(
    Math.abs(villainCentre.y - ringCentre.y),
    "he should stand on the ring's horizontal axis"
  ).toBeLessThan(RING_TOLERANCE_PX);
});

test("he arrives recoloured, arms out, and without his cape", async ({ page }) => {
  await openSite(page);

  const capeSelector = `${SELECTORS.villain} ${SELECTORS.villainCapeLeft}`;
  const tunicSelector = `${SELECTORS.villain} ${SELECTORS.villainTunic}`;
  const eyeSelector = `${SELECTORS.villain} ${SELECTORS.villainEye}`;
  const leftArm = `${SELECTORS.villain} ${SELECTORS.villainArmLeftLimb}`;
  const rightArm = `${SELECTORS.villain} ${SELECTORS.villainArmRightLimb}`;

  const before = {
    cape: await readDisplay(page, capeSelector),
    tunic: await readFill(page, tunicSelector),
    eye: await readFill(page, eyeSelector),
    leftArm: await readRotate(page, leftArm),
    rightArm: await readRotate(page, rightArm),
    label: await page.evaluate(
      (selector) => document.querySelector(selector).getAttribute("aria-label"),
      SELECTORS.villain
    )
  };

  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);
  await waitForArcs(page);
  await expect(page.locator(tunicSelector)).not.toHaveCSS("fill", before.tunic, { timeout: 10_000 });

  const after = {
    cape: await readDisplay(page, capeSelector),
    tunic: await readFill(page, tunicSelector),
    eye: await readFill(page, eyeSelector),
    leftArm: await readRotate(page, leftArm),
    rightArm: await readRotate(page, rightArm),
    label: await page.evaluate(
      (selector) => document.querySelector(selector).getAttribute("aria-label"),
      SELECTORS.villain
    )
  };

  expect(before.cape, "his cape hangs on him in the footer").not.toBe("none");
  expect(after.cape, "his cape is hidden once he lands").toBe("none");

  expect(before.leftArm, "his arms hang at his sides in the footer").toBe("none");
  expect(before.rightArm).toBe("none");
  expect(parseFloat(after.leftArm), "his arms are thrown out when he lands").toBeGreaterThan(1);
  expect(parseFloat(after.rightArm)).toBeGreaterThan(1);

  expect(rednessOf(after.tunic), "his suit should burn red").toBeGreaterThan(
    rednessOf(before.tunic)
  );
  expect(rednessOf(after.eye), "his eyes should burn red").toBeGreaterThan(rednessOf(before.eye));

  expect(after.label, "his invitation should change once he is in position").not.toBe(before.label);
});

test("his bolts leave four limbs in even fans and end on the ring", async ({ page }) => {
  await driveToLanded(page);
  await waitForArcs(page);

  const { arcs, ring, perUnit } = await readArcs(page);
  const groups = groupArcsByOrigin(arcs);

  expect(groups.length, "he should throw lightning from more than one limb").toBeGreaterThan(1);
  groups.forEach((group, index) => {
    expect(group, `limb ${index} should throw the same number of bolts as the rest`).toHaveLength(
      groups[0].length
    );
  });
  expect(arcs, "every bolt should belong to a limb").toHaveLength(
    groups.length * groups[0].length
  );

  const pointCounts = new Set(arcs.map((arc) => arc.points.length));
  expect(pointCounts.size, "every bolt should be drawn with the same number of kinks").toBe(1);

  arcs.forEach((arc, index) => {
    const reach = Math.hypot(arc.last.x - ring.centre.x, arc.last.y - ring.centre.y);
    expect(
      Math.abs(reach - ring.radius) * perUnit,
      `bolt ${index} should end on the ring circumference`
    ).toBeLessThan(CIRCUMFERENCE_TOLERANCE_PX);
  });

  const fanOf = (group) =>
    group
      .slice(1)
      .map((arc, index) =>
        turnBetween(bearing(group[index].first, group[index].last), bearing(arc.first, arc.last))
      );

  const firstFan = fanOf(groups[0]);
  expect(Math.abs(firstFan[0]), "the bolts of a limb should fan apart").toBeGreaterThan(1);

  groups.forEach((group, index) => {
    fanOf(group).forEach((step, position) => {
      expect(
        Math.abs(step - firstFan[position]),
        `limb ${index} should fan by the same step as the first`
      ).toBeLessThan(FAN_TOLERANCE_DEGREES);
    });
  });

  groups.forEach((group, index) => {
    groups.slice(index + 1).forEach((other) => {
      expect(
        Math.hypot(group[0].first.x - other[0].first.x, group[0].first.y - other[0].first.y),
        "each limb should throw from its own place on his body"
      ).toBeGreaterThan(MIN_LIMB_SEPARATION);
    });
  });
});

test("each bolt wanders sideways but keeps its place along its own line", async ({ page }) => {
  await driveToLanded(page);
  await waitForArcs(page);

  const { arcs } = await readArcs(page);

  arcs.forEach((arc, index) => {
    const from = arc.first;
    const to = arc.last;
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    const along = { x: (to.x - from.x) / span, y: (to.y - from.y) / span };
    const across = { x: -along.y, y: along.x };
    const kinks = arc.points.length - 1;

    arc.points.slice(1, -1).forEach((point, step) => {
      const travel = (step + 1) / kinks;
      const straight = {
        x: from.x + (to.x - from.x) * travel,
        y: from.y + (to.y - from.y) * travel
      };
      const drift = { x: point.x - straight.x, y: point.y - straight.y };

      expect(
        Math.abs(drift.x * across.x + drift.y * across.y) / span,
        `bolt ${index} kink ${step} should stay near its line`
      ).toBeLessThan(MAX_WANDER_FRACTION);
      expect(
        Math.abs(drift.x * along.x + drift.y * along.y),
        `bolt ${index} kink ${step} should keep its place along the bolt`
      ).toBeLessThan(ALONG_BOLT_TOLERANCE);
    });
  });
});

test("the orbit dot answers his charge and the stage is marked as charging", async ({ page }) => {
  await openSite(page);

  const calm = await readDotColour(page);

  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);
  await expect(page.locator(SELECTORS.stage)).toHaveClass(new RegExp(MARKERS.charging));
  await expect(page.locator(SELECTORS.ringDot)).not.toHaveCSS("background-color", calm, {
    timeout: 15_000
  });

  const charged = await readDotColour(page);
  expect(rednessOf(charged), "the dot should turn red").toBeGreaterThan(rednessOf(calm));
});

test("the heroine rallies to his size, a beat after he lands", async ({ page }) => {
  const { heroine } = await driveToLanded(page);

  const sizes = await page.evaluate(
    (contract) => ({
      his: document.querySelector(contract.villain).style.getPropertyValue(contract.grow),
      hers: document.querySelector(contract.heroine).style.getPropertyValue(contract.rally)
    }),
    {
      villain: SELECTORS.villain,
      heroine: SELECTORS.heroine,
      grow: TOKENS.grow,
      rally: TOKENS.rally
    }
  );

  expect(Number(sizes.hers), "she should be told to match him exactly").toBeCloseTo(
    Number(sizes.his),
    6
  );

  await waitForMarker(page, SELECTORS.heroine, MARKERS.rallying);
  await expect(heroine).toHaveCSS("scale", String(Number(sizes.hers)), { timeout: 10_000 });

  const log = await readLog(page);
  const pause =
    log.stamps[`${SELECTORS.heroine} ${MARKERS.rallying}`] -
    log.stamps[`${SELECTORS.villain} ${MARKERS.landed}`];

  expect(pause, "she should hold back while he charges").toBeGreaterThan(MIN_CHARGE_PAUSE_MS);
});
