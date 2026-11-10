import test from "node:test";
import assert from "node:assert/strict";
import {
  bodyAt,
  stepBody,
  type Solid,
  type Input,
} from "../src/game/physics/motion";
import { PHYSICS as P } from "../src/game/config";
const floor: Solid[] = [{ x: 0, y: 460, w: 1000, h: 200, id: 0 }];
const idle: Input = { left: false, right: false, jump: false, run: false };
function tick(
  b: ReturnType<typeof bodyAt>,
  input = idle,
  n = 1,
  solids = floor,
) {
  for (let i = 0; i < n; i++) stepBody(b, input, solids, P.step);
}
test("ground landing stays stable over 10 seconds", () => {
  const b = bodyAt(100, 200);
  tick(b, idle, 1200);
  assert.equal(b.y, 443);
  assert.equal(b.vy, 0);
  assert.equal(b.grounded, true);
});
test("acceleration, speed cap and braking", () => {
  const b = bodyAt(100, 443);
  tick(b);
  tick(b, { ...idle, right: true, run: true }, 60);
  assert.equal(b.vx, P.runSpeed);
  tick(b, idle, 25);
  assert.equal(b.vx, 0);
});
test("held jump is significantly higher than tap", () => {
  function height(hold: number) {
    const b = bodyAt(100, 443);
    tick(b);
    let min = b.y;
    for (let i = 0; i < 100; i++) {
      tick(b, { ...idle, jump: i < hold });
      min = Math.min(min, b.y);
    }
    return 443 - min;
  }
  assert.ok(height(80) > height(2) + 50);
  assert.ok(height(80) > 95);
});
test("coyote jump works briefly beyond platform edge", () => {
  const b = bodyAt(100, 443);
  tick(b);
  b.x = 1020;
  tick(b, idle, 8);
  tick(b, { ...idle, jump: true });
  assert.ok(b.vy < -500);
});
test("expired coyote cannot jump in midair", () => {
  const b = bodyAt(1020, 443);
  tick(b, idle, 20);
  tick(b, { ...idle, jump: true });
  assert.ok(b.vy > 0);
});
test("buffered press launches on landing without another press", () => {
  const b = bodyAt(100, 430);
  b.vy = 300;
  tick(b, { ...idle, jump: true }, 8);
  assert.ok(b.vy < 0);
  assert.equal(b.grounded, false);
});
test("head hits block and side collision cannot tunnel", () => {
  const solids = [...floor, { x: 200, y: 340, w: 32, h: 32, id: 1000 }];
  const b = bodyAt(216, 443);
  tick(b, idle, 1, solids);
  let hit = false;
  for (let i = 0; i < 60; i++) {
    tick(b, { ...idle, jump: true }, 1, solids);
    if (b.hit === 1000) hit = true;
  }
  assert.ok(hit);
  const wall = [...floor, { x: 160, y: 200, w: 32, h: 260, id: 4 }];
  const c = bodyAt(100, 443);
  tick(c, { ...idle, right: true, run: true }, 120, wall);
  assert.equal(c.x, 149);
});
test("moving platform carries grounded player", () => {
  const b = bodyAt(100, 383);
  const platform: Solid = { x: 0, y: 400, w: 200, h: 16, id: 5 };
  tick(b, idle, 1, [platform]);
  platform.x = 2;
  platform.dx = 2;
  tick(b, idle, 1, [platform]);
  assert.equal(b.x, 102);
  assert.equal(b.grounded, true);
});

test("opposite input brakes a sprint promptly without increasing forward speed", () => {
  const b = bodyAt(200, 443);
  tick(b);
  b.vx = P.runSpeed;
  const startX = b.x;
  let frames = 0;
  while (b.vx > 0 && frames++ < 60) tick(b, { ...idle, left: true, run: true });
  assert.ok(frames * P.step <= 0.12, `turn delay=${frames * P.step}`);
  assert.ok(b.x - startX < 17, `forward drift=${b.x - startX}`);
  tick(b, { ...idle, left: true, run: true }, 60);
  assert.equal(b.vx, -P.runSpeed);
});

test("airborne reversal is responsive while preserving maximum speed", () => {
  const b = bodyAt(200, -5000);
  b.vx = P.runSpeed;
  let frames = 0;
  while (b.vx > 0 && frames++ < 60)
    tick(b, { ...idle, left: true, run: true }, 1, []);
  assert.ok(frames * P.step <= 0.19);
  assert.ok(b.x - 200 < 30);
  assert.ok(b.vx >= -P.runSpeed);
});

test("releasing a sprint stops within one player width", () => {
  const b = bodyAt(200, 443);
  tick(b);
  b.vx = P.runSpeed;
  const startX = b.x;
  tick(b, idle, 30);
  assert.equal(b.vx, 0);
  assert.ok(b.x - startX <= P.playerWidth);
});

test("a jump pressed and released between render frames becomes an immediate short hop", () => {
  const b = bodyAt(200, 443);
  tick(b);
  tick(b, { ...idle, jumpPressed: true, jumpReleased: true });
  assert.equal(b.jumped, true);
  assert.ok(b.vy < 0);
  let minY = b.y;
  for (let i = 0; i < 120; i++) {
    tick(b);
    minY = Math.min(minY, b.y);
  }
  assert.ok(443 - minY > 10, "the tap must not be dropped");
  assert.ok(443 - minY < 35, "the released tap must not become a held jump");
  assert.equal(b.grounded, true);
});

test("a released buffered tap still launches a short jump on landing", () => {
  const b = bodyAt(200, 425);
  b.vy = 300;
  tick(b, { ...idle, jumpPressed: true, jumpReleased: true });
  let launched = false,
    minYAfterLaunch = 443;
  for (let i = 0; i < 100; i++) {
    tick(b);
    if (b.jumped) launched = true;
    if (launched) minYAfterLaunch = Math.min(minYAfterLaunch, b.y);
  }
  assert.equal(launched, true);
  assert.ok(443 - minYAfterLaunch > 10);
  assert.ok(443 - minYAfterLaunch < 35);
});

test("stationary moving-platform riders cannot be carried into either wall", () => {
  for (const direction of [-1, 1]) {
    const b = bodyAt(100, 383);
    const platform: Solid = { x: 0, y: 400, w: 200, h: 16, id: 0 };
    const wall: Solid = {
      x: direction > 0 ? 114 : 66,
      y: 300,
      w: 20,
      h: 100,
      id: 1,
    };
    tick(b, idle, 1, [platform, wall]);
    platform.x += direction * 5;
    platform.dx = direction * 5;
    tick(b, idle, 1, [platform, wall]);
    if (direction > 0) assert.ok(b.x + b.w / 2 <= wall.x);
    else assert.ok(b.x - b.w / 2 >= wall.x + wall.w);
    assert.equal(b.grounded, true);
  }
});

test("vertical platforms preserve support without generating repeated landing impacts", () => {
  const b = bodyAt(100, 383);
  const platform: Solid = { x: 0, y: 400, w: 200, h: 16, id: 0 };
  tick(b, idle, 1, [platform]);
  for (let i = 0; i < 120; i++) {
    platform.dy = i < 60 ? -1 : 1;
    platform.y += platform.dy;
    tick(b, idle, 1, [platform]);
    assert.equal(b.grounded, true);
    assert.equal(b.y + b.h / 2, platform.y);
    assert.equal(b.landingSpeed, 0);
  }
});

test("terminal-velocity landings do not tunnel and report impact once", () => {
  const b = bodyAt(100, 376);
  b.vy = P.maxFall;
  const platform: Solid = { x: 0, y: 400, w: 200, h: 16, id: 0 };
  tick(b, idle, 2, [platform]);
  assert.equal(b.y, 383);
  assert.equal(b.landed, true);
  assert.equal(b.landingSpeed, P.maxFall);
  tick(b, idle, 1, [platform]);
  assert.equal(b.landingSpeed, 0);
  assert.equal(b.landed, false);
});

test("30, 60, 120 and 144 Hz render schedules produce identical fixed-step motion", () => {
  const states = [30, 60, 120, 144].map((fps) => {
    const b = bodyAt(100, 443);
    tick(b);
    let accumulator = 0,
      ticks = 0;
    for (let frame = 0; frame < fps * 2; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-10 >= P.step) {
        tick(b, {
          left: ticks >= 170,
          right: ticks < 130,
          run: true,
          jump: ticks >= 30 && ticks < 70,
        });
        ticks++;
        accumulator -= P.step;
      }
    }
    return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, ticks };
  });
  states.forEach((state) => assert.deepEqual(state, states[0]));
});
