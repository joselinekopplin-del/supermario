// Run against an explicitly preserved baseline or the current tree. Native keys,
// live game loop, no teleportation or simulation calls. Snapshot access is read-only.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const phase = process.argv[2] || "after",
  root = process.argv[3] || ".",
  port = 5186;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    root,
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
  await mkdir(`artifacts/upgrade/${phase}`, { recursive: true });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(`http://127.0.0.1:${port}/?test`);
  await page.getByRole("button", { name: "开启冒险", exact: true }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `artifacts/upgrade/${phase}/menu-settled.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  const measurements = [];
  for (const hold of [...Array(12).fill(0), 450, 450]) {
    await page.keyboard.press("r");
    await page.waitForFunction(() => window.__game.snapshot().grounded);
    await page.evaluate(() => {
      const s = window.__game.scene,
        g = window.__game.game,
        origin = s.body.y;
      let min = origin,
        pressed = 0,
        response = -1;
      const key = (e) => {
        if (e.code === "Space" && !pressed) pressed = performance.now();
      };
      window.addEventListener("keydown", key);
      window.jumpMeasurement = new Promise((resolve) => {
        const sample = () => {
          if (!pressed) return;
          min = Math.min(min, s.body.y);
          if (response < 0 && s.body.y < origin - 0.1)
            response = performance.now() - pressed;
          if (
            (response >= 0 && s.body.grounded) ||
            performance.now() - pressed > 1000
          ) {
            g.events.off("postrender", sample);
            window.removeEventListener("keydown", key);
            resolve({
              height: origin - min,
              responseMs: response,
              missed: response < 0,
            });
          }
        };
        g.events.on("postrender", sample);
      });
    });
    await page.keyboard.down("Space");
    if (hold) await page.waitForTimeout(hold);
    await page.keyboard.up("Space");
    measurements.push({
      holdMs: hold,
      ...(await page.evaluate(() => window.jumpMeasurement)),
    });
  }
  const result = {
    phase,
    note: "Native keyboard event to first postrender displacement. 0ms is a very fast automation tap, not typical human duration or hardware input-to-photon latency.",
    measurements,
  };
  await writeFile(
    `artifacts/upgrade/${phase}/input-response.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  server.kill();
}
