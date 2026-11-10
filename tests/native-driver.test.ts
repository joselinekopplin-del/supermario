import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bodyAt, stepBody } from "../src/game/physics/motion";
import { levels } from "../src/game/levels";
import { lanternControl } from "./helpers/native-lantern";

test("native lantern steering converges after overshoot and upper-gallery drops", () => {
  const level = levels[1];
  const solids = level.platforms
    .filter((p) => !p.move)
    .map((p, id) => ({ ...p, id }));
  let scenarios = 0;
  for (const x of [1800, 1810, 1825, 1845, 1861.043, 1890, 1915]) {
    for (const vx of [-340, -120, 0, 120, 340]) {
      for (const y of [323, 375, 443]) {
        for (const pollingHz of [20, 30, 60, 120]) {
          const body = bodyAt(x, y);
          body.vx = vx;
          let engaged = true,
            activated = false;
          let input = lanternControl(
            { level: 2, checkpoint: false, x, vx },
            engaged,
          );
          const pollTicks = 120 / pollingHz;
          for (let tick = 0; tick < 120 * 4; tick++) {
            if (tick % pollTicks === 0) {
              input = lanternControl(
                { level: 2, checkpoint: false, x: body.x, vx: body.vx },
                engaged,
              );
              engaged = input.active;
            }
            stepBody(
              body,
              { left: input.left, right: input.right, run: true, jump: false },
              solids,
              1 / 120,
            );
            if (
              Math.abs(body.x - level.checkpoint.x) < 38 &&
              Math.abs(body.y - level.checkpoint.y) < 80
            ) {
              activated = true;
              break;
            }
          }
          assert.ok(
            activated,
            JSON.stringify({
              x,
              vx,
              y,
              pollingHz,
              finalX: body.x,
              finalY: body.y,
            }),
          );
          scenarios++;
        }
      }
    }
  }
  assert.equal(scenarios, 420);
  assert.equal(
    lanternControl({ level: 2, checkpoint: true, x: 1861, vx: 0 }, true).active,
    false,
  );
  assert.equal(
    lanternControl({ level: 1, checkpoint: false, x: 1861, vx: 0 }, true)
      .active,
    false,
  );
  assert.equal(
    lanternControl({ level: 2, checkpoint: false, x: 1790, vx: 340 }, false)
      .active,
    false,
  );
});
