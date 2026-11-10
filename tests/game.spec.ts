import { test, expect, type Page } from "@playwright/test";
declare global {
  interface Window {
    __game: any;
  }
}
async function boot(page: Page) {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.scene.player);
  await expect(
    page.getByRole("button", { name: "开启冒险", exact: true }),
  ).toBeVisible();
}
async function start(page: Page) {
  await boot(page);
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
}
test("menu, locked chapters, help, settings and persistent volumes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  await page.screenshot({ path: "artifacts/menu-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /选择章节/ }).click();
  await expect(page.locator(".level-card.locked")).toHaveCount(2);
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByRole("button", { name: "操作指南", exact: true }).click();
  await expect(page.getByText("左右移动", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "记住了" }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator("#volume-music").fill("17");
  await page.locator("#volume-music").press("ArrowRight");
  await expect(page.locator("#volume-music")).toHaveValue("18");
  await page.locator("#mute-sfx").click();
  await page.getByRole("button", { name: "完成", exact: true }).press("Space");
  await expect(
    page.getByRole("button", { name: "开启冒险", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.player);
  expect(
    await page.evaluate(() => window.__game.saveStore.data.settings),
  ).toMatchObject({ music: 0.18, sfx: 0 });
  expect(errors).toEqual([]);
});
test("real keyboard moves, jumps, collects coins and pauses", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(830);
  await page.keyboard.up("d");
  const state = await page.evaluate(() => window.__game.snapshot());
  expect(state.x).toBeGreaterThan(260);
  expect(state.coins).toBeGreaterThan(0);
  await page.keyboard.down("Space");
  await page.waitForTimeout(180);
  const jumping = await page.evaluate(() => window.__game.snapshot());
  await page.keyboard.up("Space");
  expect(jumping.y).toBeLessThan(405);
  await page.keyboard.press("Escape");
  await expect(page.getByText("旅途，可以慢一点。")).toBeVisible();
  const paused = await page.evaluate(() => window.__game.snapshot());
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__game.snapshot())).time).toBe(
    paused.time,
  );
  await page.getByRole("button", { name: "继续冒险", exact: true }).click();
  await page.keyboard.press("r");
  expect((await page.evaluate(() => window.__game.snapshot())).x).toBeLessThan(
    130,
  );
  await page.screenshot({ path: "artifacts/game-meadow.png", fullPage: true });
});
test("physical block hits, brick break and leaf power pickup", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(() => {
    const s = window.__game.scene;
    window.__game.game.loop.stop();
    const input = { left: false, right: false, jump: true, run: false };
    const results = [];
    for (const kind of ["reward", "brick", "power"]) {
      const block = s.blocks.find((b: any) => b.kind === kind);
      Object.assign(s.body, {
        x: block.x + 16,
        y: 443,
        vx: 0,
        vy: 0,
        grounded: true,
        coyote: 0.11,
        wasJump: false,
      });
      for (let i = 0; i < 35; i++) s.simulate(1 / 120, input);
      results.push(block.used);
    }
    const item = s.powerItems[0];
    Object.assign(s.body, { x: item.x, y: item.y, vx: 0, vy: 0 });
    s.simulate(1 / 120, { ...input, jump: false });
    return {
      results,
      powered: s.powered,
      coins: s.coinCount,
      bricks: s.solids.filter((b: any) => b.id === 1001).length,
    };
  });
  expect(result.results).toEqual([true, true, true]);
  expect(result.powered).toBeGreaterThan(11);
  expect(result.coins).toBeGreaterThan(0);
  expect(result.bricks).toBe(0);
});
test("stomp rebound, side damage and invulnerability prevent repeated damage", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(() => {
    const s = window.__game.scene;
    window.__game.game.loop.stop();
    const i = { left: false, right: false, jump: false, run: false };
    const e = s.enemies[0];
    Object.assign(s.body, {
      x: e.x,
      y: e.y - e.h / 2 - 18,
      vx: 0,
      vy: 170,
      grounded: false,
    });
    for (let k = 0; k < 6; k++) s.simulate(1 / 120, i);
    const stomp = { dead: !e.alive, vy: s.body.vy };
    const e2 = s.enemies[1];
    Object.assign(s.body, { x: e2.x, y: e2.y, vx: 0, vy: 0 });
    s.simulate(1 / 120, i);
    const health = s.health;
    for (let k = 0; k < 4; k++) {
      s.body.x = e2.x;
      s.body.y = e2.y;
      s.simulate(1 / 120, i);
    }
    return { stomp, health, after: s.health };
  });
  expect(result.stomp.dead).toBe(true);
  expect(result.stomp.vy).toBeLessThan(0);
  expect(result.health).toBe(2);
  expect(result.after).toBe(2);
});
test("checkpoint, pit death, retry and restart work", async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const s = window.__game.scene;
    s.body.x = s.level.checkpoint.x;
    s.body.y = 443;
    s.simulate(1 / 120, { left: false, right: false, jump: false, run: false });
    s.body.y = 630;
  });
  await expect(page.getByRole("button", { name: "再次出发" })).toBeVisible();
  await page.getByRole("button", { name: "再次出发" }).click();
  const state = await page.evaluate(() => window.__game.snapshot());
  expect(state.mode).toBe("playing");
  expect(state.checkpoint).toBe(true);
  expect(state.x).toBeGreaterThan(1800);
  expect(state.health).toBe(3);
  await page.keyboard.press("r");
  expect((await page.evaluate(() => window.__game.snapshot())).checkpoint).toBe(
    false,
  );
});
test("three goal triggers unlock chapters, final screen and durable records", async ({
  page,
}) => {
  await start(page);
  for (let level = 1; level <= 3; level++) {
    expect((await page.evaluate(() => window.__game.snapshot())).level).toBe(
      level,
    );
    if (level > 1)
      await page.screenshot({
        path: `artifacts/game-level-${level}.png`,
        fullPage: true,
      });
    await page.evaluate(() => {
      const s = window.__game.scene;
      s.body.x = s.level.goal.x;
      s.body.y = s.level.goal.y - 20;
    });
    await expect(
      page.getByText(
        level === 3 ? "微光，终于照亮了远方。" : "这一程，闪闪发光。",
        { exact: true },
      ),
    ).toBeVisible();
    if (level < 3)
      await page.getByRole("button", { name: "前往下一章" }).click();
  }
  await page.screenshot({ path: "artifacts/completion.png", fullPage: true });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.player);
  const save = await page.evaluate(() => window.__game.saveStore.data);
  expect(save.unlocked).toBe(3);
  expect(Object.keys(save.records)).toHaveLength(3);
});
test("mobile portrait and landscape layout, touch controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await start(page);
  await expect(page.locator('[data-touch="jump"]')).toBeVisible();
  await page
    .locator('[data-touch="right"]')
    .dispatchEvent("pointerdown", { pointerId: 1 });
  await page.waitForTimeout(450);
  await page
    .locator('[data-touch="right"]')
    .dispatchEvent("pointerup", { pointerId: 1 });
  expect(
    (await page.evaluate(() => window.__game.snapshot())).x,
  ).toBeGreaterThan(160);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-portrait.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({
    path: "artifacts/mobile-landscape.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
