import type { Body } from "../physics/motion";

export const CAMERA = {
  width: 960,
  height: 540,
  deadZone: 24,
  followRate: 9,
  lookRate: 5,
  lookSeconds: 0.36,
  maxLook: 130,
  fallLook: 36,
};
export interface CameraState {
  x: number;
  y: number;
  look: number;
}
export function cameraAt(x = 0): CameraState {
  return { x, y: 0, look: 80 };
}
/** Directional preview, exponential (time-based) smoothing, no physics coupling. */
export function followCamera(
  state: CameraState,
  body: Pick<Body, "x" | "y" | "vx" | "vy">,
  dt: number,
  worldWidth: number,
  reduced = false,
): CameraState {
  const desiredLook =
    Math.abs(body.vx) > 25
      ? Math.max(
          -CAMERA.maxLook,
          Math.min(CAMERA.maxLook, body.vx * CAMERA.lookSeconds),
        )
      : state.look;
  state.look +=
    (desiredLook - state.look) * (1 - Math.exp(-CAMERA.lookRate * dt));
  const target = Math.max(
    0,
    Math.min(worldWidth - CAMERA.width, body.x + state.look - CAMERA.width / 2),
  );
  const difference = target - state.x;
  if (Math.abs(difference) > CAMERA.deadZone)
    state.x +=
      (difference - Math.sign(difference) * CAMERA.deadZone) *
      (1 - Math.exp(-CAMERA.followRate * dt));
  state.x = Math.max(0, Math.min(worldWidth - CAMERA.width, state.x));
  const y =
    !reduced && body.vy > 450
      ? Math.max(0, Math.min(CAMERA.fallLook, body.y - 470))
      : 0;
  state.y += (y - state.y) * (1 - Math.exp(-8 * dt));
  return state;
}
