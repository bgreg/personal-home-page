import {
  test,
  expect,
  openSite,
  clickVillain,
  driveToRally,
  driveToDefeat,
  waitForMarker,
  settleAfterDefeat,
  animationsOn,
  readLog,
  readPalette,
  brightnessOf,
  rednessOf,
  SELECTORS,
  MARKERS
} from "./support/battle.js";

const readFooterPadding = (page) =>
  page.evaluate(
    (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).paddingTop),
    SELECTORS.footer
  );

const readPlanetSkin = (page) =>
  page.evaluate((selector) => {
    const skin = getComputedStyle(document.querySelector(selector));
    return `${skin.backgroundColor} ${skin.backgroundImage}`;
  }, SELECTORS.planet);

const isOpaque = (colour) => {
  const channels = colour.match(/\d+(\.\d+)?/g) || [];
  return channels.length < 4 || Number(channels[3]) > 0;
};

const lightestColourIn = (skin) => {
  const levels = (skin.match(/rgba?\([^)]*\)/g) || [])
    .filter(isOpaque)
    .map(brightnessOf)
    .filter((level) => level !== null);
  return levels.length ? Math.max(...levels) : 0;
};

test("he knocks her out of the sky and the page burns", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToDefeat(page);

  await expect(page.locator(SELECTORS.heroine)).toBeHidden();
  await expect(page.locator(SELECTORS.page)).toHaveClass(new RegExp(MARKERS.aftermath));
  await expect(page.locator(SELECTORS.page)).toHaveClass(new RegExp(MARKERS.showdown));
  await expect(page.locator(SELECTORS.page)).not.toHaveClass(new RegExp(MARKERS.victory));
  await expect(page.locator(SELECTORS.root)).toHaveClass(new RegExp(MARKERS.inferno));
  await expect(page.locator(SELECTORS.inferno)).toHaveCount(1);
  await expect(page.locator(SELECTORS.inferno)).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(SELECTORS.villain)).toBeVisible();
  await expect(page.locator(SELECTORS.wreck)).toHaveCount(0);
});

test("the fire repaints the palette, the footer, and the planet", async ({ page }) => {
  test.setTimeout(120_000);

  await openSite(page);
  const before = {
    palette: await readPalette(page),
    padding: await readFooterPadding(page),
    planet: await readPlanetSkin(page)
  };

  await driveToDefeat(page);

  const after = {
    palette: await readPalette(page),
    padding: await readFooterPadding(page),
    planet: await readPlanetSkin(page)
  };

  Object.keys(before.palette).forEach((token) => {
    expect(after.palette[token], `${token} should be repainted by the fire`).not.toBe(
      before.palette[token]
    );
  });

  const warmedUp = await page.evaluate((colours) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const resolved = colours.map((colour) => {
      probe.style.color = colour;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    return resolved;
  }, [before.palette["--accent"], after.palette["--accent"], before.palette["--green"], after.palette["--green"]]);

  expect(rednessOf(warmedUp[1]), "the accent should turn red").toBeGreaterThan(
    rednessOf(warmedUp[0])
  );
  expect(rednessOf(warmedUp[3]), "even the green should turn red").toBeGreaterThan(
    rednessOf(warmedUp[2])
  );

  expect(after.padding, "the footer should open up for the fire").toBeGreaterThan(before.padding);
  expect(after.planet, "the planet should be repainted").not.toBe(before.planet);
  expect(
    lightestColourIn(after.planet),
    "the planet should collapse into something darker than it was"
  ).toBeLessThan(lightestColourIn(before.planet));
});

test("the defeat throws her sideways, spinning, and out of sight", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToDefeat(page);

  const flights = await animationsOn(page, SELECTORS.heroine.slice(1));
  const knockback = flights[flights.length - 1];

  expect(flights, "she should fly in and be knocked back, never fly home").toHaveLength(2);
  expect(knockback.options.duration).toBeGreaterThan(0);
  expect(knockback.frames.length, "the knockback should have a middle").toBeGreaterThan(2);

  const finalFrame = knockback.frames[knockback.frames.length - 1];
  const drift = finalFrame.translate.split(" ").map(parseFloat);

  expect(drift[0], "she should be thrown well past her own width").toBeLessThan(
    -knockback.rect.width
  );
  expect(drift[1], "she should be driven downward").toBeGreaterThan(0);
  expect(parseFloat(finalFrame.rotate), "she should be spun over").toBeLessThan(-90);
  expect(finalFrame.opacity, "she should fade out of sight").toBe(0);
});

test("a second click on the landed villain cannot restart the showdown", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToRally(page);
  await clickVillain(page, 4);

  await settleAfterDefeat(page);

  const log = await readLog(page);
  const finisher = SELECTORS.finisherBeam.slice(1);

  expect(
    log.beams.filter((beam) => beam.includes(finisher)),
    "one showdown means one finishing shot"
  ).toHaveLength(1);
  await expect(page.locator(SELECTORS.inferno)).toHaveCount(1);
});

test("a fire already on the page is not lit a second time", async ({ page }) => {
  test.setTimeout(120_000);

  await driveToRally(page);
  await clickVillain(page);
  await waitForMarker(page, SELECTORS.heroine, MARKERS.buff);

  await page.evaluate((selector) => {
    const decoy = document.createElement("div");
    decoy.className = selector.slice(1);
    decoy.dataset.decoy = "true";
    document.body.append(decoy);
  }, SELECTORS.inferno);

  await settleAfterDefeat(page);

  await expect(page.locator(SELECTORS.inferno)).toHaveCount(1);
  expect(
    await page.evaluate(
      (selector) => document.querySelector(selector).dataset.decoy,
      SELECTORS.inferno
    ),
    "the fire already burning should be left alone"
  ).toBe("true");
});
