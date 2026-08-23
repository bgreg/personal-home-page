import {
  test,
  expect,
  openSite,
  clickVillain,
  waitForMarker,
  SETTLE_MS,
  SELECTORS,
  MARKERS,
  RESOURCES,
  BURST_TOKENS
} from "./support/battle.js";

const MAX_CURSOR_GAP_PX = 60;

const clearSpots = (page) =>
  page.evaluate((contract) => {
    const stage = document.querySelector(contract.stage).getBoundingClientRect();
    const content = document.querySelector(contract.content).getBoundingClientRect();
    const y = Math.round(Math.max(stage.top, 0) + Math.min(stage.height, 600) / 2);
    return {
      left: { x: Math.round(content.left / 2), y },
      right: { x: Math.round((content.right + globalThis.innerWidth) / 2), y }
    };
  }, { stage: SELECTORS.stage, content: SELECTORS.stageContent });

const burstCount = (page) => page.locator(SELECTORS.burst).count();

const readBursts = (page) =>
  page.evaluate((contract) =>
    [...document.querySelectorAll(contract.burst)].map((burst) => ({
      x: parseFloat(burst.style.getPropertyValue(contract.tokens.x)),
      y: parseFloat(burst.style.getPropertyValue(contract.tokens.y)),
      anchor: burst.style.getPropertyValue(contract.tokens.anchor),
      colour: burst.style.getPropertyValue(contract.tokens.colour),
      fill: burst.style.getPropertyValue(contract.tokens.fill),
      size: burst.style.getPropertyValue(contract.tokens.size),
      shout: burst.querySelector("span").textContent,
      spikes: burst.querySelector("polygon").getAttribute("points").split(" ").length,
      hidden: burst.getAttribute("aria-hidden")
    })),
  { burst: SELECTORS.burst, tokens: BURST_TOKENS });

const armEffects = (page) => page.locator(SELECTORS.heroine).click();

test("clicking her arms the effects and every later click pops a burst", async ({ page }) => {
  await openSite(page);

  expect(await burstCount(page), "the page starts quiet").toBe(0);

  const spots = await clearSpots(page);

  await armEffects(page);
  expect(await burstCount(page), "arming her pops the first burst").toBe(1);

  await page.mouse.click(spots.right.x, spots.right.y);
  expect(await burstCount(page), "an armed page pops a burst anywhere").toBe(2);

  const bursts = await readBursts(page);
  const latest = bursts[bursts.length - 1];

  expect(latest.hidden, "a burst is decoration").toBe("true");
  expect(latest.shout.length, "a burst should shout something").toBeGreaterThan(0);
  expect(latest.spikes, "a burst should be a many-pointed star").toBeGreaterThan(8);
  expect(latest.colour, "a burst should take a colour from the palette").toBeTruthy();
  expect(latest.fill, "a burst should take a fill from the palette").toBeTruthy();
  expect(parseFloat(latest.size), "a burst should be sized").toBeGreaterThan(0);

  expect(
    Math.abs(latest.x - spots.right.x),
    "a burst should sit beside the cursor"
  ).toBeLessThan(MAX_CURSOR_GAP_PX);
  expect(latest.y, "a burst should sit level with the cursor").toBeCloseTo(spots.right.y, 0);
});

test("a second click on her disarms the effects", async ({ page }) => {
  await openSite(page);
  const spots = await clearSpots(page);

  await armEffects(page);
  expect(await burstCount(page)).toBe(1);

  await armEffects(page);
  expect(await burstCount(page), "disarming should not pop a burst of its own").toBe(1);

  await page.mouse.click(spots.right.x, spots.right.y);
  expect(await burstCount(page), "a disarmed page stays quiet").toBe(1);
});

test("the fighters themselves never raise a burst", async ({ page }) => {
  await openSite(page);

  await armEffects(page);
  const armed = await burstCount(page);

  await page.locator(SELECTORS.villain).click();
  expect(await burstCount(page), "clicking a fighter is a story beat, not an effect").toBe(armed);
});

test("bursts lean away from the edge they are nearest", async ({ page }) => {
  await openSite(page);
  const spots = await clearSpots(page);
  await armEffects(page);

  await page.mouse.click(spots.left.x, spots.left.y);
  await page.mouse.click(spots.right.x, spots.right.y);

  const bursts = await readBursts(page);
  const onTheLeft = bursts[bursts.length - 2];
  const onTheRight = bursts[bursts.length - 1];
  const middle = await page.evaluate(() => globalThis.innerWidth / 2);

  expect(spots.left.x, "the first click should land left of the middle").toBeLessThan(middle);
  expect(spots.right.x, "the second click should land right of the middle").toBeGreaterThan(middle);

  expect(onTheLeft.anchor, "a burst on the left should open to the right").toBe("0%");
  expect(onTheLeft.x, "a burst on the left sits right of the cursor").toBeGreaterThan(spots.left.x);

  expect(onTheRight.anchor, "a burst on the right should open to the left").toBe("-100%");
  expect(onTheRight.x, "a burst on the right sits left of the cursor").toBeLessThan(spots.right.x);
});

test("a click with no pointer position falls back to the element it came from", async ({ page }) => {
  await openSite(page);

  await page.locator(SELECTORS.heroine).dispatchEvent("click");

  const bursts = await readBursts(page);
  const her = await page.locator(SELECTORS.heroine).boundingBox();

  expect(bursts, "a scripted click should still pop a burst").toHaveLength(1);
  expect(
    Math.abs(bursts[0].y - (her.y + her.height / 2)),
    "the burst should be placed on her, not at the pointer"
  ).toBeLessThan(1);
});

test("a click with no element behind it lands in the middle of the window", async ({ page }) => {
  await openSite(page);
  await armEffects(page);

  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
  );

  const bursts = await readBursts(page);
  const middle = await page.evaluate(() => ({
    x: globalThis.innerWidth / 2,
    y: globalThis.innerHeight / 2
  }));

  expect(bursts, "the document itself can raise a burst").toHaveLength(2);
  expect(
    Math.abs(bursts[1].x - middle.x),
    "with nothing to anchor to the burst goes to the middle"
  ).toBeLessThan(MAX_CURSOR_GAP_PX);
  expect(bursts[1].y).toBeCloseTo(middle.y, 0);
});

test("bursts clear themselves off the page when they finish", async ({ page }) => {
  await openSite(page);
  await armEffects(page);

  expect(await burstCount(page)).toBe(1);
  await expect(page.locator(SELECTORS.burst)).toHaveCount(0, { timeout: 10_000 });
});

test("sending him on his way locks the effects out for good", async ({ page }) => {
  test.setTimeout(90_000);

  await openSite(page);
  const spots = await clearSpots(page);
  await armEffects(page);
  await expect(page.locator(SELECTORS.burst)).toHaveCount(0, { timeout: 10_000 });

  await clickVillain(page, 4);
  await waitForMarker(page, SELECTORS.villain, MARKERS.launching);
  await expect(page.locator(SELECTORS.burst)).toHaveCount(0, { timeout: 10_000 });

  await page.mouse.click(spots.right.x, spots.right.y);
  await page.locator(SELECTORS.heroine).click();
  await page.waitForTimeout(SETTLE_MS);

  expect(await burstCount(page), "the effects should stay locked out once he launches").toBe(0);
});

test("with no palette to read from, the effects never arm at all", async ({ page }) => {
  await page.route(RESOURCES.clickEffectStyles, (route) => route.abort());
  await openSite(page);

  await page.locator(SELECTORS.heroine).dispatchEvent("click");
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }))
  );
  await page.waitForTimeout(SETTLE_MS);

  expect(await burstCount(page), "with no colours there is nothing to draw").toBe(0);
});
