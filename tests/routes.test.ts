import test from "node:test";
import assert from "node:assert/strict";
import { levels } from "../src/game/levels";
import { PHYSICS as P } from "../src/game/config";
import {
  bodyAt,
  overlaps,
  stepBody,
  type Solid,
} from "../src/game/physics/motion";

/** Hand-authored jump prompts. The simulation below starts at the real spawn
 * and traverses the entire level without teleporting or resetting the body.
 * This suite checks terrain/hazards; the browser suite tests live enemies.
 */
export const routeJumps: Record<number, number[]> = {
  1: [800, 1575, 2365],
  2: [585, 1150, 1460, 1895, 2425, 2705, 3020],
  3: [515, 915, 1125, 1345, 1795, 2375, 2775, 3215, 3615],
};

for (const level of levels) {
  test(`Level ${level.id}: complete terrain route with actual fixed-step physics`, (t) => {
    const solids: Solid[] = level.platforms.map((p, id) => ({ ...p, id }));
    solids.push(
      ...level.blocks.map((p, id) => ({
        x: p.x - 16,
        y: p.y - 16,
        w: 32,
        h: 32,
        id: 1000 + id,
      })),
    );
    const b = bodyAt(level.spawn.x, level.spawn.y);
    let nextJump = 0;
    let hold = 0;
    let checkpoint = false;
    let frames = 0;
    const jumps: number[] = [];
    while (b.x < level.goal.x - 25 && frames++ < 120 * 40) {
      const time = frames * P.step;
      level.platforms.forEach((p, i) => {
        if (!p.move) return;
        const s = solids[i];
        const oldX = s.x,
          oldY = s.y;
        const offset =
          Math.sin((time * Math.PI * 2) / (p.move.duration / 1000)) *
          p.move.distance;
        s.x = p.x + (p.move.axis === "x" ? offset : 0);
        s.y = p.y + (p.move.axis === "y" ? offset : 0);
        s.dx = s.x - oldX;
        s.dy = s.y - oldY;
      });
      if (b.grounded && hold === 0 && b.x >= routeJumps[level.id][nextJump]) {
        nextJump++;
        hold = 60;
      }
      const input = { left: false, right: true, run: true, jump: hold > 0 };
      stepBody(b, input, solids, P.step);
      if (b.jumped) jumps.push(Math.round(b.x));
      hold = Math.max(0, hold - 1);
      if (
        Math.abs(b.x - level.checkpoint.x) < 38 &&
        Math.abs(b.y - level.checkpoint.y) < 80
      )
        checkpoint = true;
      assert.ok(
        b.y < 620,
        `fell at x=${b.x.toFixed(1)}, next jump=${nextJump}, launches=${jumps}`,
      );
      for (const h of level.hazards) {
        assert.ok(
          !overlaps(b, { x: h.x + h.w / 2, y: h.y + h.h / 2, w: h.w, h: h.h }),
          `hazard at x=${b.x.toFixed(1)}, y=${b.y.toFixed(1)}, launches=${jumps}`,
        );
      }
    }
    assert.ok(
      b.x >= level.goal.x - 25,
      `stalled at x=${b.x}, y=${b.y}, launches=${jumps}`,
    );
    assert.ok(Math.abs(b.y - level.goal.y) < 70, "reaches goal trigger height");
    assert.ok(checkpoint, "route passes the checkpoint");
    assert.ok(jumps.length >= 3, "route uses real jumps");
    t.diagnostic(
      `Reached goal in ${(frames * P.step).toFixed(2)}s; actual jump x positions: ${jumps.join(", ")}`,
    );
  });
}
