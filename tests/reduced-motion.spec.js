import {
  test,
  expect,
  openSite,
  clickVillain,
  clickHeroine,
  readLog,
  SETTLE_MS,
  SELECTORS,
  MARKERS,
  TOKENS
} from "./support/battle.js";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the browser is asking for calm", async ({ page }) => {
  await openSite(page);

  expect(
    await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
    "this file only means anything with reduced motion on"
  ).toBe(true);
});

test("clicking the villain does nothing at all", async ({ page }) => {
  await openSite(page);

  await clickVillain(page, 8);
  await page.waitForTimeout(SETTLE_MS);

  const villain = page.locator(SELECTORS.villain);
  await expect(villain).not.toHaveClass(new RegExp(MARKERS.walking));
  await expect(villain).not.toHaveClass(new RegExp(MARKERS.launching));
  await expect(villain).not.toHaveClass(new RegExp(MARKERS.landed));
  await expect(villain).toBeVisible();

  expect(
    await page.evaluate(
      (contract) => document.querySelector(contract.villain).style.getPropertyValue(contract.grow),
      { villain: SELECTORS.villain, grow: TOKENS.grow }
    ),
    "he should not grow by a hair"
  ).toBe("");

  const log = await readLog(page);
  expect(log.animations, "nothing should be animated").toHaveLength(0);
  expect(log.arcFields, "no lightning should be drawn").toBe(0);
});

test("clicking the heroine does nothing at all", async ({ page }) => {
  await openSite(page);

  await clickHeroine(page);
  await clickHeroine(page);
  await page.waitForTimeout(SETTLE_MS);

  const heroine = page.locator(SELECTORS.heroine);
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.rallying));
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.summoned));
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.buff));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.victory));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.aftermath));
  await expect(page.locator(SELECTORS.root)).not.toHaveClass(new RegExp(MARKERS.inferno));

  const log = await readLog(page);
  expect(log.beams, "no shot should ever be fired").toHaveLength(0);
});

test("the page is never rebuilt for a fight that cannot start", async ({ page }) => {
  await openSite(page);

  await clickVillain(page, 8);
  await clickHeroine(page);
  await page.waitForTimeout(SETTLE_MS);

  await expect(page.locator(SELECTORS.arc)).toHaveCount(0);
  await expect(page.locator(SELECTORS.beam)).toHaveCount(0);
  await expect(page.locator(SELECTORS.wreck)).toHaveCount(0);
  await expect(page.locator(SELECTORS.inferno)).toHaveCount(0);
  await expect(page.locator(SELECTORS.stage)).not.toHaveClass(new RegExp(MARKERS.charging));
});

test("the comic book click effects are not held back by reduced motion", async ({ page }) => {
  await openSite(page);

  await clickHeroine(page);

  expect(
    await page.locator(SELECTORS.burst).count(),
    "the click effects have no reduced-motion gate of their own"
  ).toBe(1);
});
