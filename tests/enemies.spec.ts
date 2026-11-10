import { test, expect } from "@playwright/test";

test("solid platforms shield a standing player from hoppers underneath", async ({
  page,
}) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.scene.player);
  const result = await page.evaluate(() => {
    const s = window.__game.scene;
    window.__game.game.loop.stop();
    s.loadLevel(3);
    const platform = s.solids.find((p: any) => p.x === 800 && p.y === 380);
    Object.assign(s.body, {
      x: 845,
      y: 363,
      vx: 0,
      vy: 0,
      grounded: true,
      support: platform.id,
    });
    const hopper = s.enemies.find((e: any) => e.origin.type === "hopper");
    let minimumTop = Infinity;
    for (let frame = 0; frame < 720; frame++) {
      s.simulate(1 / 120, {
        left: false,
        right: false,
        jump: false,
        run: false,
      });
      minimumTop = Math.min(minimumTop, hopper.y - hopper.h / 2);
    }
    return {
      health: s.health,
      playerY: s.body.y,
      minimumTop,
      platformBottom: platform.y + platform.h,
      alive: hopper.alive,
    };
  });
  expect(result.health).toBe(3);
  expect(result.playerY).toBe(363);
  expect(result.minimumTop).toBeGreaterThanOrEqual(result.platformBottom);
  expect(result.alive).toBe(true);
});

test("ground patrol reverses at a solid wall without tunneling", async ({
  page,
}) => {
  await page.goto("/?test");
  await page.waitForFunction(() => window.__game?.scene.player);
  const result = await page.evaluate(() => {
    const s = window.__game.scene;
    window.__game.game.loop.stop();
    s.loadLevel(1);
    const beetle = s.enemies[0];
    const wall = { id: 9000, x: 655, y: 390, w: 32, h: 70 };
    beetle.x = 640;
    beetle.vx = 48;
    beetle.y = 449;
    beetle.grounded = true;
    let maxRight = 0;
    let reversed = false;
    for (let frame = 0; frame < 120; frame++) {
      beetle.update(1 / 120, [...s.solids, wall]);
      maxRight = Math.max(maxRight, beetle.x + beetle.w / 2);
      if (beetle.vx < 0) reversed = true;
    }
    return { maxRight, wallX: wall.x, reversed };
  });
  expect(result.reversed).toBe(true);
  expect(result.maxRight).toBeLessThanOrEqual(result.wallX);
});
