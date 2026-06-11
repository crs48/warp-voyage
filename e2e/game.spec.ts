import { expect, test, type Locator, type Page } from "@playwright/test";

type GameSnapshot = {
  readonly distance: number;
  readonly angle: number;
  readonly status: string;
  readonly scoreText: string;
  readonly crashFlashSeconds: number;
  readonly boostLevel: number;
};

const LANE_ANGLE = (Math.PI * 2) / 12;

const laneCenter = (lane: number): number => (lane + 0.5) * LANE_ANGLE;

// Drive the player from inside the page: every 50ms aim at the safe lane,
// or at a boost/obstacle lane depending on the requested mode.
const startDriver = async (
  page: Page,
  mode: "dodge" | "grabBoost" | "seekObstacle",
): Promise<void> => {
  await page.evaluate(
    ({ driverMode, laneAngle }) => {
      const hook = window.__warpVoyageTest;

      if (hook === undefined) {
        throw new Error("Warp Voyage test hook was not installed");
      }

      const existing = (window as { __driverId?: number }).__driverId;
      if (existing !== undefined) {
        clearInterval(existing);
      }

      const id = window.setInterval(() => {
        const guidance = hook.getGuidance();
        const snapshot = hook.getSnapshot();
        const playerCell = Math.floor(snapshot.distance / 4);
        const boostInReach =
          guidance.boost !== undefined && guidance.boost.cell - playerCell < 8;
        const lane =
          driverMode === "seekObstacle" && guidance.obstacle !== undefined
            ? guidance.obstacle.lane
            : driverMode === "grabBoost" && boostInReach
              ? guidance.boost.lane
              : guidance.safeLane;
        hook.setAngle((lane + 0.5) * laneAngle);
      }, 50);
      (window as { __driverId?: number }).__driverId = id;
    },
    { driverMode: mode, laneAngle: LANE_ANGLE },
  );
};

const stopDriver = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const existing = (window as { __driverId?: number }).__driverId;
    if (existing !== undefined) {
      clearInterval(existing);
    }
  });
};

const readSnapshot = async (page: Page): Promise<GameSnapshot> => {
  const snapshot = await page.evaluate(() => window.__warpVoyageTest?.getSnapshot());

  if (snapshot === undefined) {
    throw new Error("Warp Voyage test hook was not installed");
  }

  return snapshot;
};

const countNonWhiteCanvasPixels = async (
  canvas: Locator,
): Promise<number> =>
  canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("Expected a canvas element");
    }

    const sample = document.createElement("canvas");
    sample.width = 160;
    sample.height = 90;
    const context = sample.getContext("2d", { willReadFrequently: true });

    if (context === null) {
      throw new Error("Could not create a 2D sample context");
    }

    context.drawImage(element, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let nonWhite = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const alpha = pixels[index + 3] ?? 0;

      if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
        nonWhite += 1;
      }
    }

    return nonWhite;
  });

test("the full game renders, responds to controls, and restarts", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator(".game canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("DISTANCE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gyro" })).toBeVisible();

  await expect
    .poll(async () => (await readSnapshot(page)).distance)
    .toBeGreaterThan(5);

  await expect
    .poll(async () => countNonWhiteCanvasPixels(canvas))
    .toBeGreaterThan(200);

  const beforePointer = await readSnapshot(page);
  await page.mouse.move(40, 360);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  const afterPointer = await readSnapshot(page);

  expect(afterPointer.distance).toBeGreaterThan(beforePointer.distance);
  expect(afterPointer.angle).toBeCloseTo(beforePointer.angle, 3);

  await page.evaluate(() => window.__warpVoyageTest?.restart());
  await expect
    .poll(async () => (await readSnapshot(page)).status)
    .toBe("running");

  const beforeInput = await readSnapshot(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(140);
  await page.keyboard.up("ArrowRight");
  const afterInput = await readSnapshot(page);

  expect(afterInput.status).toBe("running");
  expect(afterInput.distance).toBeGreaterThan(beforeInput.distance);
  expect(afterInput.angle).toBeGreaterThan(beforeInput.angle);

  await page.evaluate(() => window.__warpVoyageTest?.forceGameOver());
  expect((await readSnapshot(page)).crashFlashSeconds).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Restart" })).toBeVisible();
  await page.keyboard.press("Space");

  await expect(page.getByRole("button", { name: "Restart" })).toBeHidden();
  await expect
    .poll(async () => (await readSnapshot(page)).status)
    .toBe("running");

  const restarted = await readSnapshot(page);
  expect(restarted.distance).toBeLessThan(afterInput.distance);
  expect(Number.parseInt(restarted.scoreText, 10)).toBeLessThan(afterInput.distance);
});

test("steering into a telegraphed cube ends a boostless run", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await readSnapshot(page)).distance).toBeGreaterThan(1);

  await startDriver(page, "seekObstacle");

  await expect
    .poll(async () => (await readSnapshot(page)).status, { timeout: 30_000 })
    .toBe("gameOver");
  await stopDriver(page);
});

test("holding the safe lane dodges every cube", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await readSnapshot(page)).distance).toBeGreaterThan(1);

  await startDriver(page, "dodge");
  await page.waitForTimeout(8_000);
  await stopDriver(page);

  const snapshot = await readSnapshot(page);
  expect(snapshot.status).toBe("running");
  expect(snapshot.distance).toBeGreaterThan(150);
});

test("passing one lane beside a cube never registers a hit", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await readSnapshot(page)).distance).toBeGreaterThan(1);

  // Aim one lane beside the next cube, at its lane center, until we have
  // passed its cell; this must never crash.
  const guidance = await page.evaluate(() => window.__warpVoyageTest?.getGuidance());

  if (guidance?.obstacle === undefined) {
    throw new Error("expected an obstacle ahead");
  }

  const besideLane = (guidance.obstacle.lane + 1) % 12;
  await page.evaluate(
    (angle) => window.__warpVoyageTest?.setAngle(angle),
    laneCenter(besideLane),
  );

  // The cube two lanes away from the safe corridor may still be telegraphed
  // for another lane; keep re-aiming beside the *current* nearest obstacle.
  await startDriver(page, "dodge");
  await expect
    .poll(async () => (await readSnapshot(page)).distance, { timeout: 15_000 })
    .toBeGreaterThan((guidance.obstacle.cell + 2) * 4);
  await stopDriver(page);

  expect((await readSnapshot(page)).status).toBe("running");
});

test("boost shields one crash, then a boostless crash ends the run", async ({ page }) => {
  await page.goto("/");
  await expect.poll(async () => (await readSnapshot(page)).distance).toBeGreaterThan(1);

  await startDriver(page, "grabBoost");
  await expect
    .poll(async () => (await readSnapshot(page)).boostLevel, { timeout: 60_000 })
    .toBeGreaterThan(0);

  // Crash with boost: run continues, boost is stripped.
  await startDriver(page, "seekObstacle");
  await expect
    .poll(
      async () => {
        const snapshot = await readSnapshot(page);
        return snapshot.boostLevel === 0 && snapshot.crashFlashSeconds > 0;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  expect((await readSnapshot(page)).status).toBe("running");

  // Crash without boost: game over.
  await expect
    .poll(async () => (await readSnapshot(page)).status, { timeout: 30_000 })
    .toBe("gameOver");
  await stopDriver(page);
});
