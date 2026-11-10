import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "after";
const directory = `artifacts/upgrade/${phase}`;
await mkdir(directory, { recursive: true });
const port = 5185;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { windowsHide: true, stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?test`);
  await page.getByRole("button", { name: "开启冒险", exact: true }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${directory}/menu.png`, fullPage: true });
  await page.getByRole("button", { name: /选择章节/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${directory}/level-select.png`,
    fullPage: true,
  });
  for (let level = 1; level <= 3; level++) {
    // Visual fixture only: full-path player validation lives in journey/keyboard tests.
    await page.evaluate((level) => window.__game.scene.loadLevel(level), level);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${directory}/level-${level}.png`,
      fullPage: true,
    });
  }
  await page.evaluate(() => {
    const s = window.__game.scene;
    s.body.x = s.level.goal.x - 95;
    s.body.y = s.level.goal.y - 17;
    s.body.vx = 0;
    s.body.vy = 0;
    s.cameraState.x = s.level.width - 960;
    s.cameras.main.setScroll(s.level.width - 960, 0);
  });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `${directory}/sky-finale.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    const s = window.__game.scene;
    s.body.x = s.level.goal.x;
    s.body.y = s.level.goal.y - 20;
  });
  await page.getByText("微光，终于照亮了远方。", { exact: true }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${directory}/complete.png`, fullPage: true });
  if (!process.argv.includes("--visual-only")) {
    await page.evaluate(() => window.__game.scene.loadLevel(1));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const metricsBefore = await cdp.send("Performance.getMetrics");
    console.log(
      `${phase}: screenshot set captured; measuring 60 seconds of live rendering`,
    );
    const performance = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const s = window.__game.scene,
            g = window.__game.game,
            frames = [],
            samples = [];
          let last = performance.now(),
            start = last;
          const sample = () => {
            const now = performance.now();
            frames.push(now - last);
            last = now;
            if (samples.length < Math.floor((now - start) / 10000) + 1)
              samples.push({
                seconds: Math.round((now - start) / 1000),
                objects: s.children.length,
                textures: s.textures.getTextureKeys().length,
                keyListeners: s.input.keyboard.listenerCount("keydown-R"),
              });
            if (now - start >= 60000) {
              g.events.off("postrender", sample);
              frames.sort((a, b) => a - b);
              resolve({
                durationSeconds: (now - start) / 1000,
                frames: frames.length,
                medianMs: frames[Math.floor(frames.length * 0.5)],
                p95Ms: frames[Math.floor(frames.length * 0.95)],
                p99Ms: frames[Math.floor(frames.length * 0.99)],
                samples,
              });
            }
          };
          g.events.on("postrender", sample);
        }),
    );
    const metricsAfter = await cdp.send("Performance.getMetrics");
    await page.close();
    const touchPerformance = [];
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1024, height: 768 },
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      const mobile = await context.newPage();
      await mobile.goto(`http://127.0.0.1:${port}/?test`);
      await mobile
        .getByRole("button", { name: "开启冒险", exact: true })
        .click();
      await mobile.waitForTimeout(200);
      await mobile.screenshot({
        path: `${directory}/touch-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
      const sample = await mobile.evaluate(
        () =>
          new Promise((resolve) => {
            const frames = [],
              g = window.__game.game;
            let last = performance.now();
            const tick = () => {
              const now = performance.now();
              frames.push(now - last);
              last = now;
              if (frames.length >= 120) {
                g.events.off("postrender", tick);
                frames.sort((a, b) => a - b);
                resolve({
                  frames: frames.length,
                  medianMs: frames[60],
                  p95Ms: frames[114],
                });
              }
            };
            g.events.on("postrender", tick);
          }),
      );
      touchPerformance.push({
        viewport,
        dpr: 2,
        mode: "desktop-browser touch emulation",
        ...sample,
      });
      await context.close();
    }
    await writeFile(
      `${directory}/runtime.json`,
      JSON.stringify(
        {
          phase,
          fixture:
            "Desktop stationary live gameplay 60s; visual scene setup uses test interface; touch screenshots DPR2",
          performance,
          touchPerformance,
          metricsBefore,
          metricsAfter,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ phase, performance, errors }));
  }
} finally {
  await browser?.close();
  server.kill();
}
