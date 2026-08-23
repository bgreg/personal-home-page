import { test, expect } from "@playwright/test";

const SHOULDER_IN_VIEWBOX = { x: 25.55, y: 17.4 };

const angleBetween = (a, b) => {
  const dot = a.x * b.x + a.y * b.y;
  const size = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return size ? (Math.acos(Math.max(-1, Math.min(1, dot / size))) * 180) / Math.PI : 180;
};

const driveToStandoff = async (page) => {
  await page.goto("/index.html");

  const villain = page.locator(".villain");
  const heroine = page.locator(".heroine");

  for (let click = 0; click < 4; click += 1) {
    await villain.dispatchEvent("click");
  }

  await expect(villain).toHaveClass(/is-landed/, { timeout: 30_000 });
  await expect(heroine).toHaveClass(/is-rallying/, { timeout: 15_000 });

  await heroine.dispatchEvent("click");
  await expect(heroine).toHaveClass(/is-buff/, { timeout: 15_000 });

  return { villain, heroine };
};

const measureAim = (page, shoulderInViewBox) =>
  page.evaluate((pivot) => {
    const heroine = document.querySelector(".heroine");
    const villain = document.querySelector(".villain");
    const artwork = heroine.querySelector("svg");

    const viewBoxPointOnScreen = ({ x, y }) => {
      const point = artwork.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(artwork.getScreenCTM());
      return { x: mapped.x, y: mapped.y };
    };

    const centreOf = (el) => {
      const box = el.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };

    return {
      shoulder: viewBoxPointOnScreen(pivot),
      hand: centreOf(heroine.querySelector(".lt-glove.lt-arm-r")),
      villain: centreOf(villain),
      head: centreOf(heroine.querySelector("circle.lt-skin"))
    };
  }, shoulderInViewBox);

test("the heroine's firing arm reaches toward the villain", async ({ page }) => {
  await driveToStandoff(page);

  const { shoulder, hand, villain } = await measureAim(page, SHOULDER_IN_VIEWBOX);

  const alongArm = { x: hand.x - shoulder.x, y: hand.y - shoulder.y };
  const towardVillain = { x: villain.x - shoulder.x, y: villain.y - shoulder.y };

  expect(
    hand.x,
    "the firing hand should reach past the shoulder toward the villain"
  ).toBeGreaterThan(shoulder.x);

  expect(
    angleBetween(alongArm, towardVillain),
    "the arm should point at the villain, not hang at her side"
  ).toBeLessThan(35);
});

test("her green laser leaves her hand, not her head", async ({ page }) => {
  await driveToStandoff(page);

  const beam = page.locator(".sk-beam-good").first();
  await expect(beam).toBeVisible({ timeout: 20_000 });

  const beamBox = await beam.boundingBox();
  const { hand, head } = await measureAim(page, SHOULDER_IN_VIEWBOX);

  const origin = { x: beamBox.x, y: beamBox.y + beamBox.height / 2 };
  const toHand = Math.hypot(origin.x - hand.x, origin.y - hand.y);
  const toHead = Math.hypot(origin.x - head.x, origin.y - head.y);

  expect(toHand, "the beam should start at her hand").toBeLessThan(24);

  expect(
    toHand,
    "the beam should start nearer her hand than her head"
  ).toBeLessThan(toHead);
});
