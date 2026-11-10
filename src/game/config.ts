export const VIEW = { width: 960, height: 540 };
export const PHYSICS = {
  step: 1 / 120,
  walkSpeed: 245,
  runSpeed: 340,
  acceleration: 1900,
  airAcceleration: 1350,
  // Stronger braking only while reversing. Forward speed/jump envelopes stay unchanged.
  turnAcceleration: 3400,
  airTurnAcceleration: 1950,
  friction: 2500,
  airFriction: 735,
  gravity: 1450,
  fallGravity: 1750,
  apexGravity: 1050,
  jumpVelocity: 550,
  jumpCut: 0.46,
  maxFall: 720,
  coyoteTime: 0.11,
  jumpBuffer: 0.13,
  playerWidth: 22,
  playerHeight: 34,
};
