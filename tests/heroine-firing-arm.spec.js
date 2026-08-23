import {
  test,
  expect,
  angleBetween,
  driveToStandoff,
  measureAim,
  settlePose,
  SELECTORS
} from "./support/battle.js";

const MAX_AIM_ERROR_DEGREES = 35;
const MAX_MUZZLE_DRIFT_PX = 24;

test("the heroine's firing arm reaches toward the villain", async ({ page }) => {
  await driveToStandoff(page);
  await settlePose(page, `${SELECTORS.heroine} ${SELECTORS.heroineFiringArm}`);

  const aim = await measureAim(page);

  expect(aim.transformBox, "the arm pivot should be quoted in view-box units").toBe("view-box");

  const alongArm = { x: aim.hand.x - aim.shoulder.x, y: aim.hand.y - aim.shoulder.y };
  const towardVillain = { x: aim.villain.x - aim.shoulder.x, y: aim.villain.y - aim.shoulder.y };

  expect(
    aim.hand.x,
    "the firing hand should reach past the shoulder toward the villain"
  ).toBeGreaterThan(aim.shoulder.x);

  expect(
    angleBetween(alongArm, towardVillain),
    "the arm should point at the villain, not hang at her side"
  ).toBeLessThan(MAX_AIM_ERROR_DEGREES);
});

test("her green laser leaves her hand, not her head", async ({ page }) => {
  await driveToStandoff(page);

  const beam = page.locator(SELECTORS.goodBeam).first();
  await expect(beam).toBeVisible({ timeout: 20_000 });

  const beamBox = await beam.boundingBox();
  const aim = await measureAim(page);

  const origin = { x: beamBox.x, y: beamBox.y + beamBox.height / 2 };
  const toHand = Math.hypot(origin.x - aim.hand.x, origin.y - aim.hand.y);
  const toHead = Math.hypot(origin.x - aim.head.x, origin.y - aim.head.y);

  expect(toHand, "the beam should start at her hand").toBeLessThan(MAX_MUZZLE_DRIFT_PX);

  expect(toHand, "the beam should start nearer her hand than her head").toBeLessThan(toHead);
});
