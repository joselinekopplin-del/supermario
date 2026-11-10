import { test, expect } from "@playwright/test";

const launches: Record<number, number[]> = {
  1: [540, 760, 1030, 1575, 1930, 2365, 2720],
  2: [380, 585, 950, 1150, 1460, 1895, 2180, 2425, 2705, 3020],
  3: [
    370, 515, 760, 915, 1125, 1345, 1560, 1795, 2170, 2375, 2775, 3215, 3440,
    3615,
  ],
};

test("complete all three chapters with live enemies using movement and jump inputs", async ({
  page,
}) => {
  const chapters: unknown[] = [];
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.scene.player);
  await page.evaluate(() => window.__game.game.loop.stop());
  await page.getByRole("button", { name: "开启冒险", exact: true }).click();
  for (let level = 1; level <= 3; level++) {
    expect(await page.evaluate(() => window.__game.snapshot().level)).toBe(
      level,
    );
    const result = await page.evaluate((route) => {
      const s = window.__game.scene;
      let next = 0,
        hold = 0,
        frame = 0;
      const jumps: number[] = [];
      const damage: { x: number; health: number }[] = [];
      let previousHealth = s.health;
      while (s.mode === "playing" && frame++ < 120 * 45) {
        if (s.body.grounded && hold === 0 && s.body.x >= route[next]) {
          next++;
          hold = 60;
        }
        // The cave route may bounce onto the upper gallery after a stomp.
        // Brake beside its end, drop to the lantern, then resume running.
        const visitLantern =
          s.level.id === 2 &&
          !s.checkpoint &&
          s.body.x > 1800 &&
          s.body.x < 1870;
        s.simulate(1 / 120, {
          left: visitLantern && s.body.vx > 5,
          right: !visitLantern,
          run: true,
          jump: hold > 0,
        });
        if (s.body.jumped) jumps.push(Math.round(s.body.x));
        hold = Math.max(0, hold - 1);
        if (s.health < previousHealth)
          damage.push({ x: Math.round(s.body.x), health: s.health });
        previousHealth = s.health;
      }
      s.renderPlayer();
      return {
        ...s.snapshot(),
        jumps,
        damage,
        next,
        defeated: s.enemies.filter((e: any) => !e.alive).length,
      };
    }, launches[level]);
    console.log(`Chapter ${level}: ${JSON.stringify(result)}`);
    chapters.push(result);
    expect(result.mode).toBe("complete");
    expect(result.checkpoint).toBe(true);
    expect(result.health).toBeGreaterThan(0);
    expect(result.coins).toBeGreaterThan(0);
    // Advancing is permitted only through the unlocked chapter button.
    await page.evaluate(() => window.__game.game.loop.wake());
    await expect(
      page.getByText(
        level === 3 ? "微光，终于照亮了远方。" : "这一程，闪闪发光。",
        { exact: true },
      ),
    ).toBeVisible();
    if (level < 3) {
      await page.evaluate(() => window.__game.game.loop.stop());
      await page
        .getByRole("button", { name: "前往下一章", exact: true })
        .click();
    }
  }
  const saved = await page.evaluate(() => window.__game.saveStore.data);
  expect(saved.unlocked).toBe(3);
  expect(Object.keys(saved.records)).toHaveLength(3);
  await test.info().attach("complete-journey-evidence", {
    body: JSON.stringify(chapters, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: "artifacts/journey-completed.png",
    fullPage: true,
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.player);
  expect(
    await page.evaluate(() => window.__game.saveStore.data.records),
  ).toEqual(saved.records);
});
