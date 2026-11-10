import { test, expect } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test.describe(`touch layout ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: true });

    test("all menu dialogs remain reachable and controls do not overlap", async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/?test");
      await expect(
        page.getByRole("button", { name: "开启冒险", exact: true }),
      ).toBeVisible();

      for (const action of ["settings", "help", "levels", "records"]) {
        await page.locator(`[data-action="${action}"]`).click();
        const back = page.locator('[data-action="back"]');
        await back.scrollIntoViewIfNeeded();
        await expect(back).toBeVisible();
        const bounds = (await back.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
        await back.click();
        await expect(page.locator(".overlay-menu")).toBeVisible();
      }

      await page.locator('[data-action="start:1"]').click();
      const bounds = [];
      for (const action of ["left", "right", "run", "jump"]) {
        const button = page.locator(`[data-touch="${action}"]`);
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(32);
        expect(box.height).toBeGreaterThanOrEqual(32);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        bounds.push(box);
      }
      for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
          const a = bounds[i],
            b = bounds[j];
          const overlap =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          expect(overlap).toBe(false);
        }
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("touch-layout.png"),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  });
}

test("real simultaneous touch movement, sprint and jump release correctly", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto("/?test");
    await page.locator('[data-action="start:1"]').click();
    await page.waitForFunction(() => window.__game.snapshot().grounded);
    const before = await page.evaluate(() => window.__game.snapshot());
    const touchPoints = [];
    for (const [id, action] of ["right", "run", "jump"].entries()) {
      const box = (await page
        .locator(`[data-touch="${action}"]`)
        .boundingBox())!;
      touchPoints.push({
        id,
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      });
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints,
    });
    await page.waitForTimeout(180);
    const during = await page.evaluate(() => window.__game.snapshot());
    expect(during.x).toBeGreaterThan(before.x + 10);
    expect(during.y).toBeLessThan(before.y - 20);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const input = await page.evaluate(() =>
      window.__game.scene.controls.read(),
    );
    expect(input).toEqual({
      left: false,
      right: false,
      run: false,
      jump: false,
    });
    await expect(page.locator(".touch-controls .held")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
