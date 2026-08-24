import {
  test,
  expect,
  openSite,
  clickHeroine,
  driveToStandoff,
  driveToRally,
  settleAfterVictory,
  waitForMarker,
  readLog,
  SETTLE_MS,
  driveToDefeat,
  SELECTORS,
  MARKERS
} from "./support/battle.js";

const MAX_EYE_LINE_GAP_PX = 2;
const MAX_SIZE_ADVANTAGE = 1.5;
const GAP_TOLERANCE_PX = 1;

const measureStandoff = (page) =>
  page.evaluate((contract) => {
    const ring = document.querySelector(contract.ring);
    const heroine = document.querySelector(contract.heroine);
    const villain = document.querySelector(contract.villain);
    const ringBox = ring.getBoundingClientRect();
    const her = heroine.getBoundingClientRect();
    const him = villain.getBoundingClientRect();

    const eyeLineOf = (fighter, eyeSelector) => {
      const eyes = [...fighter.querySelectorAll(eyeSelector)];
      const centres = eyes.map((eye) => {
        const box = eye.getBoundingClientRect();
        return box.top + box.height / 2;
      });
      return centres.reduce((total, value) => total + value, 0) / centres.length;
    };

    return {
      ringCentreX: ringBox.left + ringBox.width / 2,
      ringRadius: ring.offsetWidth / 2,
      heroine: {
        centreX: her.left + her.width / 2,
        width: her.width,
        layoutWidth: heroine.offsetWidth,
        scale: heroine.style.scale,
        position: heroine.style.position,
        onStage: heroine.parentElement.matches(contract.stage),
        eyeLine: eyeLineOf(heroine, contract.heroineEye)
      },
      villain: {
        centreX: him.left + him.width / 2,
        width: him.width,
        eyeLine: eyeLineOf(villain, contract.villainEye)
      }
    };
  }, {
    ring: SELECTORS.ring,
    heroine: SELECTORS.heroine,
    villain: SELECTORS.villain,
    stage: SELECTORS.stage,
    heroineEye: SELECTORS.heroineEye,
    villainEye: SELECTORS.villainEye
  });

test("she stops a ring radius and her own half-width short of him", async ({ page }) => {
  await driveToStandoff(page);

  const stand = await measureStandoff(page);
  const gap =
    stand.ringCentreX - stand.heroine.centreX - stand.ringRadius - stand.heroine.width / 2;

  expect(stand.heroine.centreX, "she should stand to his left").toBeLessThan(
    stand.villain.centreX
  );
  expect(gap, "her near edge should clear the ring, not overlap it").toBeGreaterThan(
    -GAP_TOLERANCE_PX
  );
  expect(gap, "the standoff gap should be smaller than she is").toBeLessThan(stand.heroine.width);
  expect(
    stand.ringCentreX - stand.heroine.centreX - stand.heroine.width / 2,
    "her near edge should sit just outside the ring"
  ).toBeGreaterThan(stand.ringRadius - GAP_TOLERANCE_PX);
});

test("she overmatches him and anchors into the hero stage", async ({ page }) => {
  const { heroine } = await driveToStandoff(page);

  await expect(heroine).toHaveClass(new RegExp(MARKERS.summoned));
  await expect(heroine).toHaveClass(new RegExp(MARKERS.buff));

  const stand = await measureStandoff(page);

  expect(stand.heroine.onStage, "she should be re-parented onto the hero stage").toBe(true);
  expect(stand.heroine.position).toBe("absolute");

  expect(
    Math.abs(stand.heroine.width / Number(stand.heroine.scale) - stand.heroine.layoutWidth),
    "her inline scale should account for her whole rendered size"
  ).toBeLessThan(1);

  const advantage = stand.heroine.width / stand.villain.width;
  expect(advantage, "she should end up bigger than him").toBeGreaterThan(1);
  expect(advantage, "she should not tower absurdly over him").toBeLessThan(MAX_SIZE_ADVANTAGE);
});

test("their eye lines meet", async ({ page }) => {
  await driveToStandoff(page);

  const stand = await measureStandoff(page);

  expect(
    Math.abs(stand.heroine.eyeLine - stand.villain.eyeLine),
    "they should be looking straight at each other"
  ).toBeLessThan(MAX_EYE_LINE_GAP_PX);
});

test("the rounds alternate and end with a single finisher", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);
  await settleAfterVictory(page);

  const log = await readLog(page);
  const finisher = SELECTORS.finisherBeam.slice(1);
  const good = SELECTORS.goodBeam.slice(1);
  const evil = SELECTORS.evilBeam.slice(1);

  const exchange = log.beams.slice(0, -1);
  const last = log.beams[log.beams.length - 1];

  expect(log.beams.length, "the fight should be more than one shot").toBeGreaterThan(2);
  expect(exchange.length % 2, "the exchange should be whole rounds").toBe(0);
  expect(last, "the fight should end on a finisher").toContain(finisher);
  expect(
    exchange.filter((beam) => beam.includes(finisher)),
    "only the last shot should be a finisher"
  ).toHaveLength(0);

  exchange.forEach((beam, index) => {
    expect(beam, `shot ${index} should alternate`).toContain(index % 2 === 0 ? good : evil);
  });

  const rounds = exchange.length / 2;
  expect(
    log.bruises.filter((mark) => mark === `villain:${MARKERS.struckGood}`),
    "every green shot should bruise him, the finisher included"
  ).toHaveLength(rounds + 1);
  expect(
    log.bruises.filter((mark) => mark === `heroine:${MARKERS.struckEvil}`),
    "every red shot should bruise her"
  ).toHaveLength(rounds);
});

test("clicking her before she has rallied does nothing", async ({ page }) => {
  await openSite(page);

  await clickHeroine(page);
  await clickHeroine(page);
  await page.waitForTimeout(SETTLE_MS);

  await expect(page.locator(SELECTORS.heroine)).not.toHaveClass(new RegExp(MARKERS.summoned));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));

  const log = await readLog(page);
  expect(log.beams).toHaveLength(0);
});

test("she flies in only after the rally, and the page clears for the fight", async ({ page }) => {
  await driveToRally(page);

  await clickHeroine(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.summoned);
  await waitForMarker(page, SELECTORS.page, MARKERS.showdown);

  const log = await readLog(page);
  expect(
    log.stamps[`${SELECTORS.heroine} ${MARKERS.summoned}`],
    "she should not take off before she has rallied"
  ).toBeGreaterThanOrEqual(log.stamps[`${SELECTORS.heroine} ${MARKERS.rallying}`]);
});

test("his lightning dies only when she is the one who answers", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);

  await expect(page.locator(SELECTORS.villain)).toHaveClass(new RegExp(MARKERS.challenged));
  await expect
    .poll(
      () =>
        page.evaluate(
          (contract) =>
            getComputedStyle(
              document.querySelector(`${contract.villain} ${contract.arcField}`)
            ).opacity,
          { villain: SELECTORS.villain, arcField: SELECTORS.arcField }
        ),
      { timeout: 10_000 }
    )
    .toBe("0");
});

test("his lightning keeps burning when he is the one who calls her out", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToDefeat(page);

  await expect(page.locator(SELECTORS.villain)).not.toHaveClass(new RegExp(MARKERS.challenged));
  expect(
    await page.evaluate(
      (contract) =>
        getComputedStyle(document.querySelector(`${contract.villain} ${contract.arcField}`))
          .opacity,
      { villain: SELECTORS.villain, arcField: SELECTORS.arcField }
    ),
    "his charge should still be lit on his own path"
  ).toBe("1");
});
