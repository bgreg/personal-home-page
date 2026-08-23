import {
  test,
  expect,
  openSite,
  clickVillain,
  clickHeroine,
  driveToLanded,
  driveToRally,
  driveToStandoff,
  waitForMarker,
  waitForArcs,
  readLog,
  readArcs,
  groupArcsByOrigin,
  animationsOn,
  settleAfterVictory,
  bearing,
  turnBetween,
  SETTLE_MS,
  SELECTORS,
  MARKERS,
  TOKENS
} from "./support/battle.js";

const FALLBACK_RING_TOLERANCE = 0.1;
const STRAIGHT_BOLT_TOLERANCE = 0.02;
const EDGE_FRACTION = 0.1;

const midBoltOf = (group) => group[Math.floor(group.length / 2)];

const readClickCount = (page) =>
  page.evaluate(
    (contract) => document.querySelector(contract.villain).getAttribute("style"),
    { villain: SELECTORS.villain }
  );

test("with no planet in the footer the easter egg never wakes up", async ({ page }) => {
  await openSite(page, { cut: SELECTORS.planet });
  await clickVillain(page, 6);
  await page.waitForTimeout(SETTLE_MS);

  const villain = page.locator(SELECTORS.villain);
  await expect(villain).not.toHaveClass(new RegExp(MARKERS.walking));
  await expect(villain).not.toHaveClass(new RegExp(MARKERS.landed));
  expect(await readClickCount(page), "he should not even grow").toBeNull();
});

test("with no hero section he aims at the window edge and is switched off on arrival", async ({
  page
}) => {
  test.setTimeout(90_000);

  await openSite(page, { cut: SELECTORS.stage });
  await clickVillain(page, 4);

  await page.waitForFunction(
    (selector) => document.querySelector(selector).hidden,
    SELECTORS.villain,
    { timeout: 60_000 }
  );

  await expect(page.locator(SELECTORS.villain)).not.toHaveClass(new RegExp(MARKERS.landed));
  await expect(page.locator(SELECTORS.arc)).toHaveCount(0);

  const log = await readLog(page);
  const launch = log.animations.find(
    (call) => call.name.includes("villain") && call.frames && call.frames.length === 4
  );
  const driftX = parseFloat(launch.frames[3].translate.split(" ")[0]);
  const landing = launch.rect.left + launch.rect.width / 2 + driftX;
  const windowWidth = await page.evaluate(() => globalThis.innerWidth);

  expect(driftX, "with no ring to aim at he heads across the window").toBeGreaterThan(0);
  expect(
    landing,
    "he should aim for the far edge of the window"
  ).toBeGreaterThan(windowWidth * (1 - EDGE_FRACTION));
  expect(landing, "he should not aim past the window").toBeLessThan(windowWidth);
});

test("with no orbit ring his lightning falls back to a ring drawn around him", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToLanded(page, { cut: SELECTORS.ring });
  await waitForArcs(page);

  const { arcs, ring, artworkCentre } = await readArcs(page);
  expect(ring, "the ring should be gone from the page").toBeNull();

  const reaches = arcs.map((arc) =>
    Math.hypot(arc.last.x - artworkCentre.x, arc.last.y - artworkCentre.y)
  );

  reaches.forEach((reach, index) => {
    expect(
      Math.abs(reach - reaches[0]),
      `bolt ${index} should end on the same fallback circle as the rest`
    ).toBeLessThan(FALLBACK_RING_TOLERANCE);
  });
  expect(
    reaches[0],
    "the fallback ring should be wider than he is"
  ).toBeGreaterThan(artworkCentre.y);

  const heroine = page.locator(SELECTORS.heroine);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.rallying);
  await clickHeroine(page);
  await page.waitForTimeout(SETTLE_MS);

  await expect(heroine, "with no ring there is nowhere to fly to").not.toHaveClass(
    new RegExp(MARKERS.summoned)
  );
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));
  expect((await readLog(page)).beams).toHaveLength(0);
});

test("an orbit ring with no width falls back to the same ring drawn around him", async ({
  page
}) => {
  test.setTimeout(90_000);

  await driveToLanded(page, {
    css: `${SELECTORS.ring} { width: 0 !important; height: 0 !important; border-width: 0 !important; }`
  });
  await waitForArcs(page);

  const { arcs, ring, artworkCentre } = await readArcs(page);

  expect(ring.radius, "the ring is present but measures nothing").toBe(0);

  const reaches = arcs.map((arc) =>
    Math.hypot(arc.last.x - artworkCentre.x, arc.last.y - artworkCentre.y)
  );

  reaches.forEach((reach, index) => {
    expect(
      Math.abs(reach - reaches[0]),
      `bolt ${index} should end on the same fallback circle as the rest`
    ).toBeLessThan(FALLBACK_RING_TOLERANCE);
  });
  expect(reaches[0], "the fallback ring should be wider than he is").toBeGreaterThan(
    artworkCentre.y
  );
});

test("a ring smaller than he is gets its bolts planted straight out from the centre", async ({
  page
}) => {
  test.setTimeout(90_000);

  await driveToLanded(page, { css: `${SELECTORS.stage} { ${TOKENS.ringSize}: 4px !important; }` });
  await waitForArcs(page);

  const { arcs, ring } = await readArcs(page);
  const groups = groupArcsByOrigin(arcs);

  expect(ring.radius, "the ring should be tiny but real").toBeLessThan(3);

  arcs.forEach((arc, index) => {
    const reach = Math.hypot(arc.last.x - ring.centre.x, arc.last.y - ring.centre.y);
    expect(
      Math.abs(reach - ring.radius),
      `bolt ${index} should still end on the ring`
    ).toBeLessThan(FALLBACK_RING_TOLERANCE);
  });

  const plantedOnTheRing = groups.filter((group) => {
    const bearings = group.map((arc) => bearing(ring.centre, arc.last));
    const steps = bearings.slice(1).map((angle, index) => turnBetween(bearings[index], angle));
    return steps.every((step) => Math.abs(step - steps[0]) < 0.2 && Math.abs(step) > 1);
  });

  expect(
    plantedOnTheRing.length,
    "bolts that cannot reach the ring should be planted on it along their own heading"
  ).toBeGreaterThan(0);
});

test("with no heroine on the page his showdown click goes nowhere", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToLanded(page, { cut: SELECTORS.heroine });
  await waitForArcs(page);

  await clickVillain(page, 2);
  await page.waitForTimeout(SETTLE_MS);

  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));
  await expect(page.locator(SELECTORS.villain)).toBeVisible();
  expect((await readLog(page)).beams).toHaveLength(0);
});

test("with the hero stage torn out after the rally she never takes off", async ({ page }) => {
  test.setTimeout(90_000);

  const { heroine } = await driveToRally(page);

  await page.evaluate((selector) => document.querySelector(selector).remove(), SELECTORS.stage);
  await clickHeroine(page);
  await page.waitForTimeout(SETTLE_MS);

  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.summoned));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));
  expect((await readLog(page)).beams).toHaveLength(0);
});

test("a missing limb throws its bolts along a fixed heading instead", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToLanded(page, { cut: `${SELECTORS.villain} ${SELECTORS.villainArmLeft}` });
  await waitForArcs(page);

  const { arcs } = await readArcs(page);
  const groups = groupArcsByOrigin(arcs);

  const flat = groups.filter(
    (group) => Math.abs(midBoltOf(group).last.y - midBoltOf(group).first.y) < STRAIGHT_BOLT_TOLERANCE
  );

  expect(
    flat,
    "the limb he no longer has should aim along the default heading"
  ).toHaveLength(1);
  expect(
    groups.length - flat.length,
    "the limbs he still has should be measured where they are posed"
  ).toBe(groups.length - 1);
});

test("with no screen geometry available every bolt takes the default heading", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToLanded(page, { blind: "1" });
  await waitForArcs(page);

  const { arcs } = await readArcs(page);
  const groups = groupArcsByOrigin(arcs);

  groups.forEach((group, index) => {
    const middle = midBoltOf(group);
    expect(
      Math.abs(middle.last.y - middle.first.y),
      `limb ${index} should fall back to the default heading`
    ).toBeLessThan(STRAIGHT_BOLT_TOLERANCE);
  });

  const origins = groups.map((group) => group[0].first);
  origins.forEach((origin, index) => {
    origins.slice(index + 1).forEach((other) => {
      expect(
        Math.hypot(origin.x - other.x, origin.y - other.y),
        "each limb should still throw from its own place on his body"
      ).toBeGreaterThan(1);
    });
  });
});

test("with her firing hand gone her beams leave her eyes instead", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page, {
    cut: `${SELECTORS.heroine} ${SELECTORS.heroineFiringHand}`
  });

  const reading = await page.waitForFunction((contract) => {
    const beam = document.querySelector(contract.beam);
    if (!beam) return null;
    const shot = beam.getBoundingClientRect();
    const heroine = document.querySelector(contract.heroine);
    const eyes = [...heroine.querySelectorAll(contract.eye)].map((eye) => {
      const box = eye.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    const her = heroine.getBoundingClientRect();
    return {
      beam: { x: shot.x, y: shot.y + shot.height / 2 },
      eyeLine: eyes.reduce((total, eye) => total + eye.y, 0) / eyes.length,
      height: her.height
    };
  }, {
    beam: SELECTORS.goodBeam,
    heroine: SELECTORS.heroine,
    eye: SELECTORS.heroineEye
  }, { timeout: 30_000 });

  const origin = await reading.jsonValue();

  expect(
    Math.abs(origin.beam.y - origin.eyeLine),
    "with no hand to shoot from, the beam should start on her eye line"
  ).toBeLessThan(origin.height / 4);
});

test("a wreck already in the footer is left alone", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);
  await page.evaluate((contract) => {
    const decoy = document.createElement("div");
    decoy.className = contract.wreck.slice(1);
    decoy.dataset.decoy = "true";
    document.querySelector(contract.footer).append(decoy);
  }, { wreck: SELECTORS.wreck, footer: SELECTORS.footer });

  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.wreck)).toHaveCount(1);
  expect(
    await page.evaluate((selector) => document.querySelector(selector).dataset.decoy, SELECTORS.wreck)
  ).toBe("true");
});

test("with the footer gone there is nowhere to lay the wreck", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);
  await page.evaluate((selector) => document.querySelector(selector).remove(), SELECTORS.footer);

  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.wreck)).toHaveCount(0);
  await expect(page.locator(SELECTORS.villain)).toBeHidden();
});

test("with his artwork gone he is simply switched off", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);
  await page.evaluate(
    (contract) => document.querySelector(`${contract.villain} ${contract.artwork}`).remove(),
    { villain: SELECTORS.villain, artwork: SELECTORS.artwork }
  );

  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.villain)).toBeHidden();
  await expect(page.locator(SELECTORS.wreck)).toHaveCount(0);
  await expect(page.locator(SELECTORS.stage)).not.toHaveClass(new RegExp(MARKERS.charging));

  const flights = await animationsOn(page, SELECTORS.heroine.slice(1));
  expect(flights, "she should still fly out and fly home").toHaveLength(2);
});

test("with no room left at home she stays where the fight left her", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page, {
    css: `${SELECTORS.heroine}:not([style]) { display: none !important; }`
  });
  await settleAfterVictory(page);

  const flights = await animationsOn(page, SELECTORS.heroine.slice(1));
  expect(flights, "with no measurable home she never flies back").toHaveLength(1);

  expect(
    await page.evaluate((selector) => document.querySelector(selector).getAttribute("style"), SELECTORS.heroine)
  ).toBeNull();
  expect(
    await page.evaluate(
      (selector) => document.querySelector(selector).parentElement.tagName.toLowerCase(),
      SELECTORS.heroine
    )
  ).toBe(SELECTORS.page);
});
