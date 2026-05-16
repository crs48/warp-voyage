import { expect, test, type Locator, type Page } from "@playwright/test";

type GameSnapshot = {
  readonly distance: number;
  readonly angle: number;
  readonly status: string;
  readonly scoreText: string;
  readonly crashFlashSeconds: number;
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

  const canvas = page.locator("canvas");
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

  const beforeInput = await readSnapshot(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(350);
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
