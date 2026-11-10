import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  bodyAt,
  stepBody,
  type Body,
  type Input,
  type Solid,
} from "../src/game/physics/motion";
import { PHYSICS as P } from "../src/game/config";

const idle: Input = { left: false, right: false, jump: false, run: false };
const floor: Solid[] = [{ x: -10000, y: 460, w: 20000, h: 200, id: 0 }];
const round = (n: number) => Number(n.toFixed(4));
function grounded() {
  const b = bodyAt(100, 443);
  stepBody(b, idle, floor, P.step);
  return b;
}
function stepsUntil(
  b: Body,
  input: Input,
  stop: (b: Body) => boolean,
  solids = floor,
) {
  let ticks = 0;
  do {
    stepBody(b, input, solids, P.step);
    ticks++;
  } while (!stop(b) && ticks < 1000);
  return ticks;
}
function horizontal(run: boolean) {
  const b = grounded(),
    max = run ? P.runSpeed : P.walkSpeed;
  const accelerating = stepsUntil(
    b,
    { ...idle, right: true, run },
    (b) => b.vx === max,
  );
  const stopX = b.x;
  const braking = stepsUntil(b, idle, (b) => b.vx === 0);
  const stopDistance = b.x - stopX;
  b.vx = max;
  const turnX = b.x;
  const turning = stepsUntil(b, { ...idle, left: true, run }, (b) => b.vx <= 0);
  const turnDrift = b.x - turnX;
  const reverse =
    turning + stepsUntil(b, { ...idle, left: true, run }, (b) => b.vx === -max);
  return {
    speed: max,
    startMs: round(accelerating * P.step * 1000),
    stopMs: round(braking * P.step * 1000),
    stopDistance: round(stopDistance),
    turnToZeroMs: round(turning * P.step * 1000),
    turnDrift: round(turnDrift),
    fullReversalMs: round(reverse * P.step * 1000),
  };
}
function jump(holdTicks: number, run: boolean) {
  const b = grounded();
  b.vx = run ? P.runSpeed : P.walkSpeed;
  const startX = b.x,
    startY = b.y;
  let minY = b.y,
    apexTick = 0,
    ticks = 0;
  do {
    stepBody(
      b,
      { ...idle, right: true, run, jump: ticks < holdTicks },
      floor,
      P.step,
    );
    ticks++;
    if (b.y < minY) {
      minY = b.y;
      apexTick = ticks;
    }
  } while (!b.grounded && ticks < 500);
  return {
    height: round(startY - minY),
    horizontalRange: round(b.x - startX),
    airTimeMs: round(ticks * P.step * 1000),
    apexMs: round(apexTick * P.step * 1000),
  };
}
function airborneTurn() {
  const b = bodyAt(100, -10000);
  b.vx = P.runSpeed;
  const ticks = stepsUntil(
    b,
    { ...idle, left: true, run: true },
    (b) => b.vx <= 0,
    [],
  );
  return {
    turnToZeroMs: round(ticks * P.step * 1000),
    turnDrift: round(b.x - 100),
  };
}
function frameScenario(fps: number) {
  const b = grounded();
  let accumulator = 0,
    tick = 0,
    minimumY = b.y;
  for (let frame = 0; frame < fps * 2; frame++) {
    accumulator += 1 / fps;
    while (accumulator + 1e-10 >= P.step) {
      const input = {
        left: tick >= 170,
        right: tick < 130,
        run: true,
        jump: tick >= 30 && tick < 70,
      };
      stepBody(b, input, floor, P.step);
      tick++;
      minimumY = Math.min(minimumY, b.y);
      accumulator -= P.step;
    }
  }
  return {
    fps,
    ticks: tick,
    x: round(b.x),
    y: round(b.y),
    vx: round(b.vx),
    minY: round(minimumY),
  };
}
const instant = grounded();
stepBody(instant, { ...idle, jump: true }, floor, P.step);
const metrics = {
  method:
    "Deterministic 120 Hz simulation; positions in world pixels, times in milliseconds. Horizontal jump range starts at capped speed and holds right until landing. Native browser input latency is measured separately.",
  parameters: P,
  walk: horizontal(false),
  run: horizontal(true),
  airTurn: airborneTurn(),
  shortWalkJump: jump(2, false),
  heldWalkJump: jump(120, false),
  heldRunJump: jump(120, true),
  simulationInputResponse: {
    ticksToJump: instant.jumped ? 1 : null,
    upperBoundMs: P.step * 1000,
    firstStepVerticalVelocity: round(instant.vy),
  },
  renderRates: [30, 60, 120, 144].map(frameScenario),
};
const path = resolve(
  process.argv[2] || "artifacts/upgrade/after/physics-metrics.json",
);
await mkdir(resolve(path, ".."), { recursive: true });
await writeFile(path, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
