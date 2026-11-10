import { PHYSICS as P } from "../config";
export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  id: number;
  dx?: number;
  dy?: number;
}
export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
  run: boolean;
  /** Latched native edges, consumed by the caller on one fixed tick only. */
  jumpPressed?: boolean;
  jumpReleased?: boolean;
}
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  support: number;
  coyote: number;
  buffer: number;
  wasJump: boolean;
  jumped: boolean;
  landed: boolean;
  landingSpeed: number;
  turning: boolean;
  hit: number;
}
export function bodyAt(x: number, y: number): Body {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: P.playerWidth,
    h: P.playerHeight,
    grounded: false,
    support: -1,
    coyote: 0,
    buffer: 0,
    wasJump: false,
    jumped: false,
    landed: false,
    landingSpeed: 0,
    turning: false,
    hit: -1,
  };
}
export function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2
  );
}
const approach = (v: number, t: number, d: number) =>
  v < t ? Math.min(t, v + d) : Math.max(t, v - d);
/** Fixed 120 Hz, separated-axis AABB. Platforms use top-left coordinates. */
export function stepBody(
  b: Body,
  input: Input,
  solids: Solid[],
  dt: number,
  boost = false,
): void {
  b.jumped = false;
  b.landed = false;
  b.landingSpeed = 0;
  b.hit = -1;
  const prevGround = b.grounded;
  if (b.grounded) b.coyote = P.coyoteTime;
  else b.coyote = Math.max(0, b.coyote - dt);
  b.buffer =
    input.jumpPressed || (input.jump && !b.wasJump)
      ? P.jumpBuffer
      : Math.max(0, b.buffer - dt);
  if (((!input.jump && b.wasJump) || input.jumpReleased) && b.vy < 0)
    b.vy *= P.jumpCut;
  b.wasJump = input.jump;
  const dir = Number(input.right) - Number(input.left);
  const max = (input.run ? P.runSpeed : P.walkSpeed) * (boost ? 1.12 : 1);
  b.turning = dir !== 0 && dir * b.vx < -5;
  const acceleration =
    dir * b.vx < 0
      ? b.grounded
        ? P.turnAcceleration
        : P.airTurnAcceleration
      : b.grounded
        ? P.acceleration
        : P.airAcceleration;
  b.vx = approach(
    b.vx,
    dir * max,
    (dir ? acceleration : b.grounded ? P.friction : P.airFriction) * dt,
  );
  if (b.buffer > 0 && b.coyote > 0) {
    b.vy = -P.jumpVelocity;
    // A buffered tap released before this tick must stay a short jump.
    if (!input.jump) b.vy *= P.jumpCut;
    b.buffer = 0;
    b.coyote = 0;
    b.grounded = false;
    b.jumped = true;
    b.support = -1;
  }
  const carry = solids.find((s) => s.id === b.support);
  const oldX = b.x;
  if (carry && b.grounded) {
    b.x += carry.dx || 0;
    b.y += carry.dy || 0;
  }
  b.x += b.vx * dt;
  const horizontalDisplacement = b.x - oldX;
  for (const s of solids) {
    if (
      b.x + b.w / 2 > s.x &&
      b.x - b.w / 2 < s.x + s.w &&
      b.y + b.h / 2 > s.y + 0.1 &&
      b.y - b.h / 2 < s.y + s.h - 0.1
    ) {
      // A stationary rider can still be pushed sideways by its platform.
      if (horizontalDisplacement > 0) b.x = s.x - b.w / 2;
      else if (horizontalDisplacement < 0) b.x = s.x + s.w + b.w / 2;
      b.vx = 0;
    }
  }
  const gravity =
    b.vy > 0
      ? P.fallGravity
      : Math.abs(b.vy) < 90 && input.jump
        ? P.apexGravity
        : P.gravity;
  b.vy = Math.min(P.maxFall, b.vy + gravity * dt);
  const oldBottom = b.y + b.h / 2,
    oldTop = b.y - b.h / 2;
  b.y += b.vy * dt;
  b.grounded = false;
  b.support = -1;
  for (const s of solids) {
    if (b.x + b.w / 2 <= s.x + 0.01 || b.x - b.w / 2 >= s.x + s.w - 0.01)
      continue;
    if (
      b.vy >= 0 &&
      oldBottom <= s.y + Math.max(2, s.dy || 0) &&
      b.y + b.h / 2 >= s.y
    ) {
      b.y = s.y - b.h / 2;
      b.landingSpeed = prevGround ? 0 : b.vy;
      b.vy = 0;
      b.grounded = true;
      b.support = s.id;
      b.landed = !prevGround;
    } else if (
      b.vy < 0 &&
      oldTop >= s.y + s.h - 2 &&
      b.y - b.h / 2 <= s.y + s.h
    ) {
      b.y = s.y + s.h + b.h / 2;
      b.vy = 20;
      b.hit = s.id;
    }
  }
  b.x = Math.max(b.w / 2, b.x);
}
