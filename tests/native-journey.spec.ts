import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { lanternControl } from "./helpers/native-lantern";

// These launch points were authored against the same visible terrain as a player.
// The observer below may only read snapshots; all movement goes through native keys.
const launches: Record<number, number[]> = {
  1: [540, 760, 1030, 1575, 1930, 2365, 2720],
  // Wait until the first shuttle carries us farther forward. Launching near its
  // left edge falls below the upper gallery and forces a jump into its underside.
  2: [380, 675, 950, 1150, 1460, 1895, 2180, 2425, 2705, 3020],
  3: [
    370, 515, 760, 915, 1125, 1345, 1560, 1795, 2170, 2375, 2775, 3215, 3440,
    3615,
  ],
};

test("native keyboard journey completes and saves all three chapters", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.snapshot().mode === "menu");
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();

  const held = new Set<string>();
  const key = async (name: string, down: boolean) => {
    if (held.has(name) === down) return;
    if (down) {
      await page.keyboard.down(name);
      held.add(name);
    } else {
      await page.keyboard.up(name);
      held.delete(name);
    }
  };
  const chapters: unknown[] = [];
  try {
    for (let level = 1; level <= 3; level++) {
      let state = await page.evaluate(() => window.__game.snapshot());
      expect(state.level).toBe(level);
      expect(state.mode).toBe("playing");
      const startTime = state.time;
      const initialEnemies = state.enemies;
      const wallStart = Date.now();
      let next = 0,
        releaseAt = -1,
        previousHealth = state.health,
        lanternEngaged = false;
      const jumps: number[] = [];
      const damage: { x: number; health: number }[] = [];
      const retries: {
        reason: string;
        description: string;
        x: number;
        y: number;
        time: number;
        resumeX: number;
        resumeHealth: number;
      }[] = [];
      const trail: unknown[] = [];
      let lastTrail = -1;
      await key("Shift", true);
      await key("ArrowRight", true);
      while (Date.now() - wallStart < 30_000) {
        state = await page.evaluate(() => window.__game.snapshot());
        if (state.health < previousHealth)
          damage.push({ x: Math.round(state.x), health: state.health });
        previousHealth = state.health;
        if (state.time - lastTrail > 0.3) {
          trail.push(state);
          lastTrail = state.time;
        }
        if (state.mode === "dead") {
          // A real player may fail once after lighting a lantern. Release input,
          // use the visible retry button and verify the actual saved checkpoint.
          // A second death, or a death before any checkpoint, still fails below.
          if (!state.checkpoint || retries.length >= 1) break;
          for (const name of [...held]) await key(name, false);
          const retry = page.getByRole("button", {
            name: "再次出发",
            exact: true,
          });
          await expect(retry).toBeVisible();
          const description = await page
            .locator(".dialog-description")
            .innerText();
          const death = state;
          await retry.click();
          state = await page.evaluate(() => window.__game.snapshot());
          expect(state.mode).toBe("playing");
          expect(state.level).toBe(level);
          expect(state.checkpoint).toBe(true);
          expect(state.health).toBe(3);
          expect(state.x).toBeCloseTo([1850, 1820, 2040][level - 1] + 32, 0);
          expect(state.coins).toBe(death.coins);
          expect(state.score).toBe(death.score);
          expect(state.time).toBeGreaterThanOrEqual(death.time);
          retries.push({
            reason: description.includes("深坑")
              ? "pit"
              : description.includes("晶刺")
                ? "hazard"
                : "enemy",
            description,
            x: death.x,
            y: death.y,
            time: death.time,
            resumeX: state.x,
            resumeHealth: state.health,
          });
          const remaining = launches[level].findIndex((x) => x > state.x);
          next = remaining < 0 ? launches[level].length : remaining;
          releaseAt = -1;
          lanternEngaged = false;
          previousHealth = state.health;
          await key("Shift", true);
          await key("ArrowRight", true);
          continue;
        }
        if (state.mode !== "playing") break;

        const lantern = lanternControl(state, lanternEngaged);
        lanternEngaged = lantern.active;
        if (lantern.active) {
          // Do not consume the next chasm's jump while correcting an overshoot.
          await key("Space", false);
          releaseAt = -1;
          await key("ArrowRight", lantern.right);
          await key("ArrowLeft", lantern.left);
          continue;
        }

        if (releaseAt >= 0 && state.time >= releaseAt) {
          await key("Space", false);
          releaseAt = -1;
        }
        if (
          state.grounded &&
          releaseAt < 0 &&
          state.x >= launches[level][next]
        ) {
          jumps.push(Math.round(state.x));
          next++;
          releaseAt = state.time + 0.5;
          await key("Space", true);
        }
        await key("ArrowRight", true);
        await key("ArrowLeft", false);
      }
      for (const name of [...held]) await key(name, false);
      const result = {
        ...state,
        jumps,
        damage,
        retryCount: retries.length,
        retries,
        next,
        defeated: initialEnemies - state.enemies,
        wallSeconds: (Date.now() - wallStart) / 1000,
        simulatedSeconds: state.time - startTime,
      };
      chapters.push(result);
      const evidencePath = testInfo.outputPath(`native-chapter-${level}.json`);
      await writeFile(evidencePath, JSON.stringify({ result, trail }, null, 2));
      await testInfo.attach(`native-chapter-${level}`, {
        path: evidencePath,
        contentType: "application/json",
      });
      console.log(`Native chapter ${level}: ${JSON.stringify(result)}`);
      expect(
        state.mode,
        `chapter ${level} ended at x=${state.x.toFixed(1)}, y=${state.y.toFixed(1)}`,
      ).toBe("complete");
      expect(state.checkpoint).toBe(true);
      expect(state.health).toBeGreaterThan(0);
      expect(retries.length).toBeLessThanOrEqual(1);
      expect(state.coins).toBeGreaterThan(0);
      expect(state.time).toBeGreaterThan(startTime + 5);
      if (level === 1) expect(result.defeated).toBeGreaterThan(0);
      await expect(
        page.getByText(
          level === 3 ? "微光，终于照亮了远方。" : "这一程，闪闪发光。",
          { exact: true },
        ),
      ).toBeVisible();
      if (level < 3)
        await page
          .getByRole("button", { name: "前往下一章", exact: true })
          .click();
    }
  } finally {
    for (const name of [...held]) await key(name, false);
    const evidencePath = testInfo.outputPath("native-journey-evidence.json");
    await writeFile(evidencePath, JSON.stringify(chapters, null, 2));
    await testInfo.attach("native-journey-evidence", {
      path: evidencePath,
      contentType: "application/json",
    });
  }
  const saved = await page.evaluate(() => window.__game.saveStore.data);
  expect(saved.unlocked).toBe(3);
  expect(Object.keys(saved.records)).toHaveLength(3);
  await page.screenshot({
    path: testInfo.outputPath("native-journey-complete.png"),
    fullPage: true,
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.snapshot().mode === "menu");
  expect(
    await page.evaluate(() => window.__game.saveStore.data.records),
  ).toEqual(saved.records);
  expect(errors).toEqual([]);
});
