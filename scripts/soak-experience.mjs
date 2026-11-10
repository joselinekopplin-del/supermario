import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const port = 5187;
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
  await mkdir("artifacts/upgrade/after", { recursive: true });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?test`);
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  await page.evaluate(() => {
    const s = window.__game.scene;
    for (let id = 1; id <= 3; id++) s.loadLevel(id);
    s.loadLevel(1);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const before = await cdp.send("Performance.getMetrics");
  console.log("Sampling 120 seconds, six world loads and capped burst stress");
  const sample = await page.evaluate(async () => {
    const { burst } = await import("/src/game/effects/particles.ts");
    const { scene: s, game: g } = window.__game;
    return new Promise((resolve) => {
      const frames = [],
        resources = [],
        epochs = Array.from({ length: 6 }, () => []);
      let start = performance.now(),
        last = start,
        stage = 0,
        lastBurst = -1,
        lastSample = -1;
      const tick = () => {
        const now = performance.now(),
          seconds = (now - start) / 1000,
          frame = now - last;
        last = now;
        frames.push(frame);
        epochs[stage].push(frame);
        const nextStage = Math.min(5, Math.floor(seconds / 20));
        if (nextStage !== stage) {
          stage = nextStage;
          s.loadLevel((stage % 3) + 1);
        }
        const burstIndex = Math.floor(seconds / 5);
        if (burstIndex !== lastBurst) {
          lastBurst = burstIndex;
          for (let i = 0; i < 8; i++) burst(s, 180, 360, 0xffdd88, 30, 50);
        }
        const sampleIndex = Math.floor(seconds / 10);
        if (sampleIndex !== lastSample && seconds % 10 > 1) {
          lastSample = sampleIndex;
          resources.push({
            seconds: Math.round(seconds),
            level: s.level.id,
            objects: s.children.length,
            textures: s.textures.getTextureKeys().length,
            tweens: s.tweens.getTweens().length,
            keys: s.input.keyboard.listenerCount("keydown-R"),
          });
        }
        if (seconds >= 120) {
          g.events.off("postrender", tick);
          const stats = (v) => {
            v.sort((a, b) => a - b);
            return {
              frames: v.length,
              medianMs: v[Math.floor(v.length * 0.5)],
              p95Ms: v[Math.floor(v.length * 0.95)],
              p99Ms: v[Math.floor(v.length * 0.99)],
            };
          };
          resolve({
            durationSeconds: seconds,
            overall: stats(frames),
            epochs: epochs.map((v, i) => ({ level: (i % 3) + 1, ...stats(v) })),
            resources,
          });
        }
      };
      g.events.on("postrender", tick);
    });
  });
  await page.evaluate(() => window.__game.scene.loadLevel(1));
  await page.waitForTimeout(1000);
  await cdp.send("HeapProfiler.collectGarbage");
  const after = await cdp.send("Performance.getMetrics");
  const result = {
    note: "Synthetic 120-second desktop soak with six world loads and burst saturation every5s. Garbage collection only before/after sampling. Not a device fleet or hours-long soak.",
    sample,
    before,
    after,
    errors,
  };
  await writeFile(
    "artifacts/upgrade/after/soak.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify({ sample, errors }));
} finally {
  await browser?.close();
  server.kill();
}
