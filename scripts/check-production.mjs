import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const root = resolve("dist");
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/sample-game/")) {
    res.writeHead(404).end();
    return;
  }
  const relative =
    decodeURIComponent(url.pathname.slice("/sample-game/".length)) ||
    "index.html";
  const path = resolve(root, relative);
  if (!path.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(path);
    res.setHeader(
      "Content-Type",
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[
        extname(path)
      ] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/sample-game/`);
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  await page.keyboard.down("d");
  await page.waitForTimeout(830);
  await page.keyboard.up("d");
  assert.ok(
    Number(await page.locator("#hud-coins").textContent()) > 0,
    "keyboard movement collected a coin in built game",
  );
  assert.equal(
    await page.evaluate(() => typeof window.__game),
    "undefined",
    "test hook stripped from production",
  );
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last;
        function frame(now) {
          if (last) times.push(now - last);
          last = now;
          if (times.length < 120) requestAnimationFrame(frame);
          else resolve(times);
        }
        requestAnimationFrame(frame);
      }),
  );
  frames.sort((a, b) => a - b);
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/production.png", fullPage: true });
  assert.deepEqual(errors, []);
  const result = {
    subpath: "/sample-game/",
    requestsAndRuntimeErrors: errors,
    coinPickup: true,
    debugHookAbsent: true,
    rafSamples: frames.length,
    medianRafIntervalMs: Number(frames[60].toFixed(2)),
    p95RafIntervalMs: Number(frames[114].toFixed(2)),
  };
  await writeFile(
    "artifacts/production-check.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
