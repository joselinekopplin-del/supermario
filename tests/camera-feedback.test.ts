import test from "node:test";
import assert from "node:assert/strict";
import { bodyAt } from "../src/game/physics/motion";
import { CAMERA, cameraAt, followCamera } from "../src/game/systems/camera";
import { PlayerFeedback } from "../src/game/effects/playerFeedback";

test("camera previews movement direction and eases through a reversal", () => {
  const body = bodyAt(1500, 443);
  body.vx = 340;
  const camera = cameraAt(1000);
  for (let i = 0; i < 120; i++) followCamera(camera, body, 1 / 60, 5000);
  assert.ok(camera.look > 100 && camera.look <= CAMERA.maxLook);
  const beforeTurn = { ...camera };
  body.vx = -340;
  followCamera(camera, body, 1 / 60, 5000);
  assert.ok(camera.look < beforeTurn.look);
  assert.ok(
    camera.look > 0,
    "one reversal tick must not instantly flip the preview",
  );
  assert.ok(Math.abs(camera.x - beforeTurn.x) < 20);
  for (let i = 0; i < 60; i++) followCamera(camera, body, 1 / 60, 5000);
  assert.ok(camera.look < -100 && camera.look >= -CAMERA.maxLook);
});

test("camera respects world edges and a world narrower than the viewport", () => {
  for (const width of [640, 960, 3440]) {
    const body = bodyAt(0, 443);
    const camera = cameraAt();
    for (const x of [-500, 112, width - 10, width + 500]) {
      body.x = x;
      body.vx = x < width / 2 ? -340 : 340;
      for (let i = 0; i < 120; i++) followCamera(camera, body, 1 / 60, width);
      assert.ok(camera.x >= 0);
      assert.ok(camera.x <= Math.max(0, width - CAMERA.width));
    }
  }
});

test("camera dead zone ignores small idle position corrections", () => {
  const body = bodyAt(1000, 443);
  const camera = cameraAt(600);
  for (const x of [1000, 1010, 990, 1005]) {
    body.x = x;
    followCamera(camera, body, 1 / 60, 5000);
    assert.equal(camera.x, 600);
  }
});

test("camera settling has the same duration at 30, 60, 120 and 144 Hz", () => {
  const positions = [30, 60, 120, 144].map((fps) => {
    const body = bodyAt(1800, 443);
    const camera = cameraAt(300);
    for (let frame = 0; frame < fps; frame++)
      followCamera(camera, body, 1 / fps, 5000);
    return camera.x;
  });
  positions.forEach((x) => assert.ok(Math.abs(x - positions[0]) < 1e-8));
});

test("moving camera trajectories remain close across render refresh rates", () => {
  const positions = [30, 60, 120, 144].map((fps) => {
    const body = bodyAt(800, 443);
    body.vx = 340;
    const camera = cameraAt(400);
    for (let frame = 0; frame < fps * 3; frame++) {
      body.x = 800 + (340 * (frame + 1)) / fps;
      followCamera(camera, body, 1 / fps, 5000);
    }
    return camera.x;
  });
  assert.ok(
    Math.max(...positions) - Math.min(...positions) < 6,
    `positions=${positions}`,
  );
});

test("fast-fall camera preview is bounded and reduced motion disables it", () => {
  const body = bodyAt(1200, 560);
  body.vy = 720;
  const normal = cameraAt(),
    reduced = cameraAt();
  for (let i = 0; i < 120; i++) {
    followCamera(normal, body, 1 / 60, 5000);
    followCamera(reduced, body, 1 / 60, 5000, true);
  }
  assert.ok(normal.y > 30 && normal.y <= CAMERA.fallLook);
  assert.equal(reduced.y, 0);
  body.vy = -550;
  for (let i = 0; i < 120; i++) followCamera(normal, body, 1 / 60, 5000);
  assert.ok(
    normal.y < 0.001,
    "jumping must return smoothly to the stable horizon",
  );
});

test("landing feedback scales with impact while keeping deformation restrained", () => {
  const gentle = new PlayerFeedback(),
    hard = new PlayerFeedback();
  gentle.land(100, false);
  hard.land(720, false);
  assert.ok(hard.scaleX > gentle.scaleX && gentle.scaleX > 1);
  assert.ok(hard.scaleY < gentle.scaleY && gentle.scaleY < 1);
  assert.ok(hard.scaleX <= 1.14 && hard.scaleY >= 0.86);
});

test("airborne animation overrides an unfinished landing pose", () => {
  const feedback = new PlayerFeedback(),
    body = bodyAt(100, 350);
  body.vy = -300;
  assert.equal(feedback.texture(body, 1, 0.075), "player-jump");
  body.vy = 100;
  assert.equal(feedback.texture(body, 1, 0.075), "player-fall");
  body.grounded = true;
  assert.equal(feedback.texture(body, 1, 0.075), "player-land");
});

test("run animation advances with travel distance instead of wall-clock speed", () => {
  const walk = new PlayerFeedback(),
    run = new PlayerFeedback();
  const walker = bodyAt(100, 443),
    runner = bodyAt(100, 443);
  walker.vx = 170;
  runner.vx = 340;
  for (let i = 0; i < 120; i++) walk.tick(walker, 1 / 120, false);
  for (let i = 0; i < 60; i++) run.tick(runner, 1 / 120, false);
  assert.ok(Math.abs(walk.runPhase - run.runPhase) < 1e-10);
});

test("visual deformation settles consistently without mutating collider state", () => {
  const values = [30, 60, 120].map((fps) => {
    const feedback = new PlayerFeedback(),
      body = bodyAt(100, 350);
    body.vx = 240;
    body.vy = -200;
    const before = structuredClone(body);
    feedback.jump(false);
    feedback.hurt();
    for (let i = 0; i < fps; i++) feedback.tick(body, 1 / fps, false);
    assert.deepEqual(body, before);
    assert.equal(feedback.hurtTime, 0);
    return feedback.scaleX;
  });
  values.forEach((x) => assert.ok(Math.abs(x - values[0]) < 1e-10));
});

test("reduced motion restores neutral scale and suppresses jump/landing deformation", () => {
  const feedback = new PlayerFeedback(),
    body = bodyAt(100, 443);
  feedback.jump(false);
  feedback.tick(body, 1 / 60, true);
  assert.equal(feedback.scaleX, 1);
  assert.equal(feedback.scaleY, 1);
  feedback.jump(true);
  feedback.land(720, true);
  assert.equal(feedback.scaleX, 1);
  assert.equal(feedback.scaleY, 1);
});
