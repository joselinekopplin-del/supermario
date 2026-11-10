import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
test("Escape toggles once per press even with queued keys and key repeat", async ({
  page,
}) => {
  await page.goto("/?test");
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    await page.keyboard.down("Escape");
    await page.keyboard.down("Escape"); // native repeat must not resume
    await expect(
      page.getByText("旅途，可以慢一点。", { exact: true }),
    ).toBeVisible();
    await page.keyboard.up("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(".game-overlay")).toBeHidden();
    expect(await page.evaluate(() => window.__game.snapshot().mode)).toBe(
      "playing",
    );
  }
});

test("repeated scene resets keep objects/listeners bounded and render near 60 FPS", async ({
  page,
}) => {
  await page.goto("/?test");
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  const counts = await page.evaluate(() => {
    const s = window.__game.scene;
    s.loadLevel(1);
    const before = {
      objects: s.children.length,
      textures: s.textures.getTextureKeys().length,
      keys: s.input.keyboard.listenerCount("keydown-R"),
    };
    for (let i = 0; i < 12; i++) s.loadLevel(1);
    return {
      before,
      after: {
        objects: s.children.length,
        textures: s.textures.getTextureKeys().length,
        keys: s.input.keyboard.listenerCount("keydown-R"),
      },
    };
  });
  expect(counts.after).toEqual(counts.before);
  const frames: number[] = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const game = window.__game.game;
        const values: number[] = [];
        let last = performance.now();
        const sample = () => {
          const now = performance.now();
          values.push(now - last);
          last = now;
          if (values.length === 120) {
            game.events.off("postrender", sample);
            resolve(values);
          }
        };
        game.events.on("postrender", sample);
      }),
  );
  frames.sort((a, b) => a - b);
  const median = frames[60];
  expect(median).toBeGreaterThan(2);
  expect(median).toBeLessThan(25);
  await writeFile(
    "artifacts/performance.json",
    JSON.stringify(
      {
        samples: 120,
        medianRenderMs: +median.toFixed(2),
        p95RenderMs: +frames[114].toFixed(2),
        approxMedianFPS: Math.round(1000 / median),
        resetObjectCounts: counts,
      },
      null,
      2,
    ),
  );
});
test("malformed browser save safely falls back to a playable menu", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("mosslight-save-v1", "{broken"),
  );
  await page.goto("/?test");
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  expect(await page.evaluate(() => window.__game.snapshot().mode)).toBe(
    "playing",
  );
});
