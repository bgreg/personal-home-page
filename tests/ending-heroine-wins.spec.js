import {
  test,
  expect,
  openSite,
  clickVillain,
  clickHeroine,
  driveToStandoff,
  driveToRally,
  settleAfterVictory,
  settleHeroineHome,
  animationsOn,
  readCustomProperty,
  asRgb,
  SELECTORS,
  MARKERS,
  TOKENS
} from "./support/battle.js";

const RESTING_TOLERANCE_PX = 1;
const HOME_TOLERANCE_PX = 1;

const readVillainRest = (page) =>
  page.evaluate((selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { centreX: box.left + box.width / 2, bottom: box.bottom };
  }, SELECTORS.villain);

const readHeroineHome = (page) =>
  page.evaluate((selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }, SELECTORS.heroine);

test("she blows him apart and the page turns to victory", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);

  const pieces = await page.evaluate(
    (contract) => document.querySelectorAll(`${contract.villain} ${contract.bodyPart}`).length,
    { villain: SELECTORS.villain, bodyPart: SELECTORS.bodyPart }
  );
  expect(pieces, "he should be built out of many pieces").toBeGreaterThan(1);

  await driveToStandoff(page);
  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.villain)).toBeHidden();
  await expect(page.locator(SELECTORS.page)).toHaveClass(new RegExp(MARKERS.victory));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.showdown));
  await expect(page.locator(SELECTORS.stage)).not.toHaveClass(new RegExp(MARKERS.charging));

  const thrown = await page.evaluate(
    (contract) =>
      [...document.querySelectorAll(`${contract.villain} ${contract.bodyPart}`)].filter(
        (part) => part.style.transformBox === "view-box" && part.style.transformOrigin
      ).length,
    { villain: SELECTORS.villain, bodyPart: SELECTORS.bodyPart }
  );
  expect(thrown, "every piece of him should be pinned and thrown").toBe(pieces);

  const leftoverBolts = await page.evaluate(
    (contract) => document.querySelectorAll(`${contract.villain} ${contract.arcField}`).length,
    { villain: SELECTORS.villain, arcField: SELECTORS.arcField }
  );
  expect(leftoverBolts, "his lightning should be gone before he bursts").toBe(0);
});

test("the orbit dot cools back to the colour it started", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);
  const calm = await page.evaluate(
    (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor,
    SELECTORS.ringDot
  );

  await driveToStandoff(page);
  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.ringDot)).toHaveCSS("background-color", calm, {
    timeout: 20_000
  });
});

test("his wreck rests where he stood, in his charged colours", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);
  const stood = await readVillainRest(page);
  const livingCape = await page.evaluate(
    (contract) =>
      getComputedStyle(document.querySelector(`${contract.villain} ${contract.cape}`)).fill,
    { villain: SELECTORS.villain, cape: SELECTORS.villainCapeLeft }
  );

  await driveToStandoff(page);
  await settleAfterVictory(page);

  const wreck = page.locator(SELECTORS.wreck);
  await expect(wreck).toHaveCount(1);
  await expect(wreck).toHaveAttribute("aria-hidden", "true");

  const grown = await page.evaluate(
    (contract) => ({
      wreck: document.querySelector(contract.wreck).style.getPropertyValue(contract.grow),
      villain: document.querySelector(contract.villain).style.getPropertyValue(contract.grow)
    }),
    { wreck: SELECTORS.wreck, villain: SELECTORS.villain, grow: TOKENS.grow }
  );
  expect(Number(grown.wreck), "the wreck should be his size, not his starting size").toBeCloseTo(
    Number(grown.villain),
    6
  );

  expect(
    await page.evaluate(
      (contract) => document.querySelectorAll(`${contract.wreck} ${contract.arcField}`).length,
      { wreck: SELECTORS.wreck, arcField: SELECTORS.arcField }
    ),
    "the wreck should not carry his lightning"
  ).toBe(0);

  expect(
    await page.evaluate(
      (contract) => document.querySelector(`${contract.wreck} ${contract.artwork}`).hasAttribute("role"),
      { wreck: SELECTORS.wreck, artwork: SELECTORS.artwork }
    ),
    "the wreck is decoration, not an image"
  ).toBe(false);

  const chargedCape = await readCustomProperty(page, SELECTORS.wreck, TOKENS.cape);
  const wreckCape = page.locator(`${SELECTORS.wreck} ${SELECTORS.villainCapeLeft}`);
  await expect(wreckCape, "the wreck should wear the charged palette").toHaveCSS(
    "fill",
    await asRgb(page, chargedCape)
  );
  await expect(wreckCape, "the wreck should not be the colour he was alive").not.toHaveCSS(
    "fill",
    livingCape
  );

  const rests = await page.evaluate(
    (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { centreX: box.left + box.width / 2, bottom: box.bottom };
    },
    SELECTORS.wreck
  );

  expect(
    Math.abs(rests.centreX - stood.centreX),
    "the wreck should lie where he stood"
  ).toBeLessThan(RESTING_TOLERANCE_PX);
  expect(
    Math.abs(rests.bottom - stood.bottom),
    "the wreck should rest on the same ground"
  ).toBeLessThan(RESTING_TOLERANCE_PX);
});

test("every piece of the wreck is thrown down into a pile", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToStandoff(page);
  await settleAfterVictory(page);
  await expect(page.locator(SELECTORS.wreck)).toHaveCount(1);

  const posed = await page.evaluate((contract) => {
    const wreck = document.querySelector(contract.wreck);
    const artwork = wreck.querySelector(contract.artwork);
    const viewBox = artwork.viewBox.baseVal;

    const parts = [...wreck.querySelectorAll(contract.bodyPart)].map((part) => {
      const box = part.getBBox();
      const shift = part.style.translate.split(" ").map(parseFloat);
      return {
        translate: { x: shift[0] || 0, y: shift[1] || 0 },
        rotate: parseFloat(part.style.rotate),
        transformBox: part.style.transformBox,
        origin: part.style.transformOrigin,
        centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      };
    });

    const loose = [...wreck.querySelectorAll(contract.loosePlate)].map((part) => ({
      rotate: parseFloat(part.style.rotate)
    }));

    return { parts, loose, viewBox: { width: viewBox.width, height: viewBox.height } };
  }, {
    wreck: SELECTORS.wreck,
    artwork: SELECTORS.artwork,
    bodyPart: SELECTORS.bodyPart,
    loosePlate: SELECTORS.loosePlate
  });

  expect(posed.parts.length, "the wreck should be made of many pieces").toBeGreaterThan(1);

  posed.parts.forEach((part, index) => {
    expect(part.transformBox, `piece ${index} should be pinned in view-box units`).toBe("view-box");
    expect(part.origin, `piece ${index} should be given a pivot`).toBeTruthy();
    expect(Number.isNaN(part.rotate), `piece ${index} should be turned over`).toBe(false);
    expect(
      part.centre.y + part.translate.y,
      `piece ${index} should come to rest in the bottom of the frame`
    ).toBeGreaterThan(posed.viewBox.height * 0.6);
  });

  expect(posed.loose.length, "some pieces are not named in the script").toBeGreaterThan(1);
  posed.loose.forEach((plate, index) => {
    if (index === 0) return;
    expect(
      Math.sign(plate.rotate),
      `loose piece ${index} should fall the opposite way to the one before`
    ).toBe(-Math.sign(posed.loose[index - 1].rotate));
    expect(
      Math.abs(plate.rotate),
      `loose piece ${index} should be turned further than the one before`
    ).toBeGreaterThan(Math.abs(posed.loose[index - 1].rotate));
  });
});

test("she flies home and drops every trace of the fight", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);
  const home = await readHeroineHome(page);
  const neighbour = await page.evaluate((selector) => {
    const her = document.querySelector(selector);
    return {
      parent: her.parentElement.tagName.toLowerCase(),
      next: her.nextElementSibling ? her.nextElementSibling.tagName.toLowerCase() : null
    };
  }, SELECTORS.heroine);

  await driveToStandoff(page);
  await settleAfterVictory(page);
  await settleHeroineHome(page);

  const heroine = page.locator(SELECTORS.heroine);
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.summoned));
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.buff));
  await expect(heroine).not.toHaveClass(new RegExp(MARKERS.rallying));

  const homecoming = await page.evaluate((selector) => {
    const her = document.querySelector(selector);
    const box = her.getBoundingClientRect();
    return {
      style: her.getAttribute("style"),
      parent: her.parentElement.tagName.toLowerCase(),
      next: her.nextElementSibling ? her.nextElementSibling.tagName.toLowerCase() : null,
      rect: { left: box.left, top: box.top, width: box.width }
    };
  }, SELECTORS.heroine);

  expect(homecoming.style, "she should carry no inline state home").toBeNull();
  expect(homecoming.parent).toBe(neighbour.parent);
  expect(homecoming.next).toBe(neighbour.next);
  expect(Math.abs(homecoming.rect.left - home.left)).toBeLessThan(HOME_TOLERANCE_PX);
  expect(Math.abs(homecoming.rect.top - home.top)).toBeLessThan(HOME_TOLERANCE_PX);
  expect(Math.abs(homecoming.rect.width - home.width)).toBeLessThan(HOME_TOLERANCE_PX);

  const flights = await animationsOn(page, SELECTORS.heroine.slice(1));
  expect(flights, "she should fly out once and home once").toHaveLength(2);
  expect(flights[1].options.duration, "the flight home should take real time").toBeGreaterThan(0);
});

test("clicking the villain after she has committed cannot flip the ending", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToRally(page);

  await clickHeroine(page);
  await clickVillain(page, 3);

  await settleAfterVictory(page);

  await expect(page.locator(SELECTORS.page)).toHaveClass(new RegExp(MARKERS.victory));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.aftermath));
  await expect(page.locator(SELECTORS.root)).not.toHaveClass(new RegExp(MARKERS.inferno));
  await expect(page.locator(SELECTORS.wreck)).toHaveCount(1);
});
