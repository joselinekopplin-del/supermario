import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test.beforeAll(async () => {
  await mkdir("artifacts/upgrade/after", { recursive: true });
});

test("restart clears not-yet-inserted completion timers", async ({ page }) => {
  await start(page);
  // Same JS turn reproduces the window before Phaser Clock.preUpdate inserts timers.
  await page.evaluate(() => {
    const s = window.__game.scene;
    s.complete();
    s.loadLevel(1);
  });
  await page.waitForTimeout(1400);
  await expect(page.locator(".game-overlay")).toBeHidden();
  expect(await page.evaluate(() => window.__game.snapshot().mode)).toBe(
    "playing",
  );
  expect(
    await page.evaluate(() => window.__game.scene.player.texture.key),
  ).toMatch(/^player-idle/);
});

test("reduced effects retain the global particle ceiling and settings apply in menus", async ({
  page,
}) => {
  await page.goto("/?test");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator("#setting-motion").check();
  await page.locator("#setting-effects").selectOption("low");
  const moving = await page.evaluate(
    () =>
      window.__game.scene.tweens.getTweens().filter((t: any) => !t.isPaused())
        .length,
  );
  expect(moving).toBe(0);
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  const count = await page.evaluate(async () => {
    const s = window.__game.scene;
    const { burst } = await import("/src/game/effects/particles.ts" as string);
    const initial = s.children.length;
    for (let i = 0; i < 60; i++) burst(s, 180, 300, 0xffdd88, 30, 60);
    return s.children.length - initial;
  });
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(96);
});

async function start(page: Page) {
  await page.goto("/?test");
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  await page.waitForFunction(() => window.__game.snapshot().grounded);
}

test("native short taps survive frame boundaries and differ from held jumps", async ({
  page,
}) => {
  await start(page);
  const measurements = [];
  for (const hold of [0, 450, 0, 450]) {
    await page.keyboard.press("r");
    await page.waitForFunction(() => window.__game.snapshot().grounded);
    await page.evaluate(() => {
      const w = window as any,
        s = w.__game.scene,
        g = w.__game.game;
      const origin = s.body.y;
      let min = origin,
        pressed = 0,
        response = -1,
        frames = 0;
      const key = (e: KeyboardEvent) => {
        if (e.code === "Space" && !pressed) pressed = performance.now();
      };
      window.addEventListener("keydown", key);
      w.jumpMeasurement = new Promise((resolve) => {
        const sample = () => {
          if (!pressed) return;
          min = Math.min(min, s.body.y);
          if (response < 0 && s.body.y < origin - 0.1)
            response = performance.now() - pressed;
          if (
            (response >= 0 && s.body.grounded && ++frames > 2) ||
            performance.now() - pressed > 1800
          ) {
            g.events.off("postrender", sample);
            window.removeEventListener("keydown", key);
            resolve({
              height: origin - min,
              responseMs: response,
              landed: s.body.grounded,
            });
          }
        };
        g.events.on("postrender", sample);
      });
    });
    await page.keyboard.down("Space");
    if (hold) await page.waitForTimeout(hold);
    await page.keyboard.up("Space");
    const result = await page.evaluate(() => (window as any).jumpMeasurement);
    expect(result.responseMs).toBeGreaterThanOrEqual(0);
    expect(result.responseMs).toBeLessThan(100);
    expect(result.landed).toBe(true);
    expect(result.height).toBeGreaterThan(8);
    measurements.push({ holdMs: hold, ...result });
  }
  expect(measurements[1].height).toBeGreaterThan(measurements[0].height * 2.5);
  expect(measurements[3].height).toBeGreaterThan(measurements[2].height * 2.5);
  await writeFile(
    "artifacts/upgrade/after/native-input.json",
    JSON.stringify(
      {
        note: "Native Playwright keyboard events to first visible postrender movement; desktop automation, not hardware latency.",
        measurements,
      },
      null,
      2,
    ),
  );
});

test("actual scene accumulator takes identical steps at 30/60/120/144 Hz", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(() => {
    const { scene: s, game } = window.__game;
    game.loop.stop();
    return [30, 60, 120, 144].map((hz) => {
      s.loadLevel(1);
      for (let i = 0; i < hz * 2; i++) s.update((i * 1000) / hz, 1000 / hz);
      return {
        hz,
        time: s.elapsed,
        x: s.body.x,
        y: s.body.y,
        remainder: s.accumulator,
      };
    });
  });
  for (const r of result) {
    expect(r.time).toBeCloseTo(2, 10);
    expect(r.x).toBeCloseTo(result[0].x, 10);
    expect(r.y).toBeCloseTo(result[0].y, 10);
    expect(r.remainder).toBeLessThan(1e-9);
  }
});

test("checkpoint retry clears stale failure timer and displays safe spawn immediately", async ({
  page,
}) => {
  await start(page);
  // Focused fixture: check the retry transition, not an end-to-end route.
  const state = await page.evaluate(() => {
    const s = window.__game.scene;
    s.checkpoint = true;
    s.die("pit");
    s.respawn();
    return {
      ...s.snapshot(),
      texture: s.player.texture.key,
      alpha: s.player.alpha,
      scale: s.player.scaleY,
      spriteX: s.player.x,
      bodyWidth: s.body.w,
    };
  });
  expect(state.mode).toBe("playing");
  expect(state.texture).not.toBe("player-hurt");
  expect(state.alpha).toBeGreaterThanOrEqual(0.75);
  expect(state.scale).toBe(1);
  expect(state.spriteX).toBeCloseTo(state.x, 0);
  expect(state.health).toBe(3);
  await page.waitForTimeout(500);
  await expect(page.locator(".game-overlay")).toBeHidden();
  expect(await page.evaluate(() => window.__game.snapshot().mode)).toBe(
    "playing",
  );
});

test("all-world rebuilds and burst peaks keep textures, listeners and live objects bounded", async ({
  page,
}) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const s = window.__game.scene;
    for (let id = 1; id <= 3; id++) s.loadLevel(id);
    const counts = () => ({
      objects: s.children.length,
      textures: s.textures.getTextureKeys().length,
      keys: s.input.keyboard.listenerCount("keydown-SPACE"),
      tweens: s.tweens.getTweens().length,
    });
    const baseline = counts();
    for (let i = 0; i < 20; i++) s.loadLevel((i % 3) + 1);
    s.loadLevel(3);
    const after = counts();
    const { burst } = await import("/src/game/effects/particles.ts" as string);
    const initial = s.children.length;
    for (let i = 0; i < 30; i++) burst(s, 180, 300, 0xffdd88, 30, 60);
    const peak = s.children.length - initial;
    return { baseline, after, peak };
  });
  expect(result.after).toEqual(result.baseline);
  expect(result.peak).toBeLessThanOrEqual(96);
  await page.waitForTimeout(900);
  const remaining = await page.evaluate(
    () => window.__game.scene.children.length,
  );
  expect(remaining).toBe(result.after.objects);
  await writeFile(
    "artifacts/upgrade/after/resource-stress.json",
    JSON.stringify(result, null, 2),
  );
});
