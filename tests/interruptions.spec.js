import {
  test,
  expect,
  openSite,
  clickVillain,
  clickHeroine,
  driveToRally,
  waitForMarker,
  SELECTORS,
  MARKERS
} from "./support/battle.js";

const NEVER_ENDING = `@keyframes test-hover { from { opacity: 1; } to { opacity: 1; } }
  ${SELECTORS.heroine} { animation: test-hover 2s linear infinite !important; }`;

const cancelAnimationsOn = (page, selector) =>
  page.evaluate(
    (target) => document.querySelector(target).getAnimations().forEach((move) => move.cancel()),
    selector
  );

const countAnimationsOn = (page, fragment) =>
  page.evaluate(
    (needle) => window.__log.animations.filter((call) => call.name.includes(needle)).length,
    fragment
  );

test("a walk that is cut short lets him be sent on his way again", async ({ page }) => {
  test.setTimeout(90_000);

  await openSite(page);
  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.walking);

  expect(await countAnimationsOn(page, "villain")).toBe(1);

  await cancelAnimationsOn(page, SELECTORS.villain);
  await clickVillain(page);

  await page.waitForFunction(
    () => window.__log.animations.filter((call) => call.name.includes("villain")).length > 1,
    null,
    { timeout: 20_000 }
  );

  await waitForMarker(page, SELECTORS.villain, MARKERS.landed);
});

test("a flight that is cut short lets her be summoned again", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToRally(page);
  await clickHeroine(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.summoned);

  expect(await countAnimationsOn(page, "heroine")).toBe(1);

  await cancelAnimationsOn(page, SELECTORS.heroine);
  await clickHeroine(page);

  await page.waitForFunction(
    () => window.__log.animations.filter((call) => call.name.includes("heroine")).length > 1,
    null,
    { timeout: 20_000 }
  );

  await waitForMarker(page, SELECTORS.heroine, MARKERS.buff);
});

test("an animation that can never finish is cancelled so she can still fly in", async ({ page }) => {
  test.setTimeout(90_000);

  await driveToRally(page, { css: NEVER_ENDING });

  const endless = await page.evaluate(
    (selector) =>
      document
        .querySelector(selector)
        .getAnimations()
        .some((move) => move.effect.getTiming().iterations === Infinity),
    SELECTORS.heroine
  );
  expect(endless, "she should be carrying an animation that cannot be finished").toBe(true);

  await clickHeroine(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.buff);

  await expect(page.locator(SELECTORS.heroine)).toHaveClass(new RegExp(MARKERS.summoned));
  await expect(page.locator(SELECTORS.page)).toHaveClass(new RegExp(MARKERS.showdown));
});
