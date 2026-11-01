import { test, expect } from "@playwright/test";

const CARD = "details.game";
const STAGE = '.game-stage[data-game="life"]';
const CANVAS = `${STAGE} canvas`;
const OVERLAY_TITLE = `${STAGE} .overlay-title`;
const READOUT = (name) => `${STAGE} [data-hud="${name}"]`;
const ACTS = ["life", "hang", "meet", "reveal", "chase", "corner", "finale", "morph", "message"];

/* The board paces itself from the browser's animation clock, so handing it a
   clock that jumps fifty milliseconds a frame as fast as timers allow plays
   the whole story in a few seconds without changing a line of it. */
const FAST_CLOCK = `(() => {
  let now = performance.now();
  window.requestAnimationFrame = (callback) => setTimeout(() => callback((now += 50)), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
})();`;

const openTheBoard = async (page) => {
  await page.goto("/index.html");
  await page.locator(CARD, { hasText: "Game of Life" }).locator("summary").click();
  await expect(page.locator(CANVAS)).toBeVisible();
};

const start = (page) => page.locator(CANVAS).click();

const act = (page) => page.locator(STAGE).getAttribute("data-act");

const waitForAct = (page, name) =>
  page.waitForFunction(
    (contract) => document.querySelector(contract.stage).dataset.act === contract.name,
    { stage: STAGE, name },
    { timeout: 40_000 }
  );

/* Reads the board back off the canvas as a grid of live cells. */
const readBoard = (page) =>
  page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    const cell = 8;
    const cols = 480 / cell;
    const rows = 320 / cell;
    const scale = canvas.width / 480;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const cells = [];
    for (let y = 0; y < rows; y++) {
      let row = "";
      for (let x = 0; x < cols; x++) {
        const px = Math.round((x * cell + cell / 2) * scale);
        const py = Math.round((y * cell + cell / 2) * scale);
        const i = (py * canvas.width + px) * 4;
        row += data[i] + data[i + 1] + data[i + 2] > 300 ? "#" : ".";
      }
      cells.push(row);
    }
    return cells;
  }, CANVAS);

/* Conway's rules on a board with dead edges, exactly as the game applies them. */
const nextGeneration = (board) =>
  board.map((row, y) =>
    [...row]
      .map((here, x) => {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const line = board[y + dy];
            if (line && line[x + dx] === "#") n += 1;
          }
        }
        return n === 3 || (here === "#" && n === 2) ? "#" : ".";
      })
      .join("")
  );

const redPixels = (page) =>
  page.evaluate((selector) => {
    const canvas = document.querySelector(selector);
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 140 && data[i + 1] < 90 && data[i + 2] < 90) red += 1;
    }
    return red;
  }, CANVAS);

test("the card presents a plain Game of Life", async ({ page }) => {
  await openTheBoard(page);

  await expect(page.locator(OVERLAY_TITLE)).toHaveText("Game of Life");
  await expect(page.locator(READOUT("gen"))).toHaveText("0");
  await expect(page.locator(READOUT("gliders"))).toHaveText("5");
  expect(Number(await page.locator(READOUT("alive")).textContent()), "the seed is populated").toBeGreaterThan(100);
  expect(await act(page), "nothing has happened yet").toBe("life");
  expect(await redPixels(page), "the board starts in the site palette").toBe(0);
});

test("the first eighty generations are the real rules, cell for cell", async ({ page }) => {
  await openTheBoard(page);
  const seed = await readBoard(page);
  expect(seed.join("").split("#").length - 1, "the seed was read off the canvas").toBeGreaterThan(100);

  let expected = seed;
  for (let generation = 0; generation < 80; generation += 1) expected = nextGeneration(expected);

  await start(page);
  await waitForAct(page, "hang");
  const frozen = await readBoard(page);

  expect(frozen, "the board at the hang is what Conway's rules make of the seed").toEqual(expected);
});

test("the rules run honestly once the board is started", async ({ page }) => {
  await openTheBoard(page);
  await start(page);

  await expect(page.locator(`${STAGE} .game-overlay`)).toBeHidden();
  await expect(page.locator(READOUT("gen"))).not.toHaveText("0");
  const early = Number(await page.locator(READOUT("gen")).textContent());
  await page.waitForTimeout(1000);
  const later = Number(await page.locator(READOUT("gen")).textContent());
  expect(later, "generations keep ticking").toBeGreaterThan(early);
  expect(later, "at about nine generations a second").toBeLessThan(early + 20);
  expect(await act(page), "still an honest simulation").toBe("life");
  expect(await redPixels(page), "nothing is red yet").toBe(0);
});

test("the simulation hangs on generation eighty and the story plays out to the end", async ({ page }) => {
  await page.addInitScript(FAST_CLOCK);
  await openTheBoard(page);
  await start(page);

  await waitForAct(page, "hang");
  await expect(page.locator(READOUT("gen"))).toHaveText("80");
  await expect(page.locator(READOUT("gliders"))).toHaveText("5");

  const seen = new Set();
  for (const name of ACTS.slice(1)) {
    await waitForAct(page, name);
    seen.add(name);
  }
  expect([...seen], "every beat of the story is reached in order").toEqual(ACTS.slice(1));

  await expect(page.locator(OVERLAY_TITLE)).toHaveText("Happy Halloween", { timeout: 40_000 });
  await expect(page.locator(READOUT("gen")), "the counter never moved again").toHaveText("80");
  await expect(page.locator(READOUT("gliders")), "only the villain is left").toHaveText("1");
  expect(await redPixels(page), "the board ends bloody").toBeGreaterThan(2000);
});

test("the story also reaches its end under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(FAST_CLOCK);
  await openTheBoard(page);
  await start(page);

  await waitForAct(page, "message");
  await expect(page.locator(OVERLAY_TITLE)).toHaveText("Happy Halloween", { timeout: 40_000 });
  await expect(page.locator(READOUT("gliders"))).toHaveText("1");
});

test("the board can be paused and restarted like the other games", async ({ page }) => {
  await openTheBoard(page);
  await start(page);
  await expect(page.locator(READOUT("gen"))).not.toHaveText("0");

  await page.locator(CANVAS).press("p");
  await expect(page.locator(OVERLAY_TITLE)).toHaveText("Paused");
  const paused = await page.locator(READOUT("gen")).textContent();
  await page.waitForTimeout(500);
  expect(await page.locator(READOUT("gen")).textContent(), "a paused board stands still").toBe(paused);

  await page.locator(CANVAS).press("p");
  await expect(page.locator(`${STAGE} .game-overlay`)).toBeHidden();
  await expect(page.locator(READOUT("gen"))).not.toHaveText(paused);
});
