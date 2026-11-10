import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page) {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.scene.player);
}
async function start(page: Page) {
  await boot(page);
  await page.locator('[data-action="start:1"]').click();
}
async function audioState(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/game/audio/audio.ts";
    return (await import(path)).audio.diagnostics();
  });
}

test("v1 progress survives new preferences, which persist across reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mosslight-save-v1"))
      localStorage.setItem(
        "mosslight-save-v1",
        JSON.stringify({
          unlocked: 2,
          records: { 1: { score: 4200, coins: 27, time: 92.6 } },
          settings: { music: 0.18, sfx: 0.46 },
        }),
      );
  });
  await boot(page);
  const before = await page.evaluate(() => window.__game.saveStore.data);
  expect(before.settings).toEqual({
    music: 0.18,
    sfx: 0.46,
    screenShake: true,
    reducedMotion: false,
    effects: "full",
  });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator("#setting-shake").uncheck();
  await page.locator("#setting-motion").check();
  await page.locator("#setting-effects").selectOption("low");
  await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  await page.screenshot({
    path: "artifacts/upgrade/after/ui-settings.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "设置", exact: true }),
  ).toBeFocused();
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.player);
  const after = await page.evaluate(() => window.__game.saveStore.data);
  expect(after.records).toEqual(before.records);
  expect(after.unlocked).toBe(2);
  expect(after.settings).toEqual({
    music: 0.18,
    sfx: 0.46,
    screenShake: false,
    reducedMotion: true,
    effects: "low",
  });
  await page.getByRole("button", { name: /选择章节/ }).click();
  await expect(page.locator(".level-1")).toContainText("4,200");
  await expect(page.locator(".level-1")).toContainText("01:32");
  await expect(page.locator(".level-1")).toContainText("已完成");
  await expect(page.locator(".level-2")).toContainText("已解锁");
  await expect(page.locator(".level-3")).toBeDisabled();
  await page.screenshot({
    path: "artifacts/upgrade/after/ui-level-records.png",
    fullPage: true,
  });
});

test("modal keyboard focus stays inside; nested Escape returns to paused game", async ({
  page,
}) => {
  await start(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "声音与画面", exact: true }).click();
  await expect(page.locator(".game-toast")).not.toHaveClass(/show/);
  const finish = page.getByRole("button", { name: "完成", exact: true });
  await finish.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#volume-music")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(finish).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "继续冒险", exact: true }),
  ).toBeFocused();
  expect((await page.evaluate(() => window.__game.snapshot())).mode).toBe(
    "paused",
  );
  await page.keyboard.press("Escape");
  expect((await page.evaluate(() => window.__game.snapshot())).mode).toBe(
    "playing",
  );
  await page.keyboard.down("Space");
  await page.waitForTimeout(150);
  await page.keyboard.up("Space");
  expect((await page.evaluate(() => window.__game.snapshot())).y).toBeLessThan(
    415,
  );
});

test("failure identifies cause and actual respawn, with Enter retry", async ({
  page,
}) => {
  await start(page);
  // Fault injection isolates the failure screen; actual browser Enter performs retry.
  await page.evaluate(() => {
    window.__game.scene.body.y = 650;
  });
  await expect(
    page.getByRole("button", { name: "再次出发", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".dialog-description")).toContainText("深坑");
  await expect(page.locator(".checkpoint-hint")).toContainText("本关起点");
  await page.keyboard.press("Enter");
  expect((await page.evaluate(() => window.__game.snapshot())).mode).toBe(
    "playing",
  );
  expect((await page.evaluate(() => window.__game.snapshot())).x).toBeLessThan(
    150,
  );
  await page.evaluate(() => {
    const s = window.__game.scene;
    s.body.x = s.level.checkpoint.x;
    s.body.y = 443;
    s.simulate(1 / 120, { left: false, right: false, jump: false, run: false });
    s.body.y = 650;
  });
  await expect(
    page.getByRole("button", { name: "再次出发", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".checkpoint-hint")).toContainText("从检查点继续");
  await page.keyboard.press("Enter");
  const retried = await page.evaluate(() => window.__game.snapshot());
  expect(retried.checkpoint).toBe(true);
  expect(retried.health).toBe(3);
  expect(retried.x).toBeGreaterThan(1800);
});

test("native Web Audio cancels scheduled voices on pause and bounds repeated SFX", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const probe: {
      context?: AudioContext;
      voices: Array<{ start: number; stop: number }>;
    } = { voices: [] };
    (window as any).__audioProbe = probe;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      probe.context = this;
      const oscillator = original.call(this);
      const record = { start: Infinity, stop: Infinity };
      probe.voices.push(record);
      const start = oscillator.start.bind(oscillator),
        stop = oscillator.stop.bind(oscillator);
      oscillator.start = (when = 0) => {
        record.start = when;
        start(when);
      };
      oscillator.stop = (when = 0) => {
        record.stop = when;
        stop(when);
      };
      return oscillator;
    };
  });
  await boot(page);
  expect((await audioState(page)).contextState).toBe("locked");
  await page.locator('[data-action="start:1"]').click();
  await expect
    .poll(async () => (await audioState(page)).step)
    .toBeGreaterThan(2);
  const previousStep = (await audioState(page)).step;
  await page.keyboard.press("Escape");
  expect(await audioState(page)).toMatchObject({
    playing: false,
    schedulerCount: 0,
    musicVoices: 0,
    sfxVoices: 0,
  });
  const paused = await page.evaluate(() => {
    const probe = (window as any).__audioProbe;
    const now = probe.context.currentTime;
    return {
      remainingLongVoices: probe.voices.filter((v: any) => v.stop > now + 0.02)
        .length,
      maximumTail: Math.max(0, ...probe.voices.map((v: any) => v.stop - now)),
    };
  });
  expect(paused.remainingLongVoices).toBe(0);
  expect(paused.maximumTail).toBeLessThanOrEqual(0.02);
  await page.getByRole("button", { name: "继续冒险", exact: true }).click();
  expect((await audioState(page)).step).toBeGreaterThanOrEqual(previousStep);
  const burst = await page.evaluate(async () => {
    const path = "/src/game/audio/audio.ts";
    const { audio } = await import(path);
    audio.stopAll();
    const probe = (window as any).__audioProbe,
      before = probe.voices.length;
    for (let i = 0; i < 100; i++) audio.play("coin");
    const repeated = {
      count: probe.voices.length - before,
      ...audio.diagnostics(),
    };
    for (let i = 0; i < 30; i++)
      for (const sound of ["jump", "bump", "stomp", "power", "checkpoint"])
        audio.play(sound);
    const mixed = audio.diagnostics();
    audio.stopAll();
    for (let i = 0; i < 8; i++) audio.startMusic(i % 2 ? "cave" : "sky");
    const switched = audio.diagnostics();
    audio.stopAll();
    return { repeated, mixed, switched, stopped: audio.diagnostics() };
  });
  expect(burst.repeated.count).toBe(2);
  expect(burst.mixed.sfxVoices).toBeLessThanOrEqual(12);
  expect(burst.switched.schedulerCount).toBe(1);
  expect(burst.stopped).toMatchObject({
    musicVoices: 0,
    sfxVoices: 0,
    schedulerCount: 0,
  });
  await test.info().attach("native-audio-scheduler", {
    body: JSON.stringify({ previousStep, paused, burst }, null, 2),
    contentType: "application/json",
  });
});

test("touch layout preserves world aspect ratio at phone, tablet and high DPI sizes", async ({
  browser,
}) => {
  for (const [width, height, deviceScaleFactor] of [
    [390, 844, 3],
    [844, 390, 3],
    [1024, 768, 2],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await start(page);
    const sizes = await page.evaluate(() => {
      const canvas = document.querySelector("canvas")!.getBoundingClientRect();
      const buttons = Array.from(
        document.querySelectorAll<HTMLElement>("[data-touch]"),
      ).map((b) => {
        const r = b.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      });
      return {
        canvas: {
          x: canvas.x,
          y: canvas.y,
          width: canvas.width,
          height: canvas.height,
          right: canvas.right,
          bottom: canvas.bottom,
        },
        buttons,
        overflow: document.documentElement.scrollWidth > innerWidth,
        width: innerWidth,
        height: innerHeight,
      };
    });
    expect(sizes.overflow).toBe(false);
    expect(sizes.canvas.width / sizes.canvas.height).toBeCloseTo(16 / 9, 1);
    for (const b of sizes.buttons) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(sizes.width);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(sizes.height);
      if (height < 521)
        expect(
          b.right <= sizes.canvas.x + 1 || b.x >= sizes.canvas.right - 1,
        ).toBe(true);
    }
    await page.screenshot({
      path: `artifacts/upgrade/after/ui-touch-${width}x${height}-dpr${deviceScaleFactor}.png`,
      fullPage: true,
    });
    const jump = await page.locator('[data-touch="jump"]').boundingBox();
    const y = (await page.evaluate(() => window.__game.snapshot())).y;
    await page.touchscreen.tap(
      jump!.x + jump!.width / 2,
      jump!.y + jump!.height / 2,
    );
    await page.waitForTimeout(140);
    expect(
      (await page.evaluate(() => window.__game.snapshot())).y,
    ).toBeLessThan(y - 8);
    await context.close();
  }
});
