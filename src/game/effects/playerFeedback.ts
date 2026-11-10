import type { Body } from "../physics/motion";
export const FEEDBACK = {
  settleRate: 22,
  runStride: 22,
  dustInterval: 0.13,
  landingDuration: 0.075,
  hurtDuration: 0.2,
};
/** Sprite-only deformation: collider and jump timing remain unchanged. */
export class PlayerFeedback {
  scaleX = 1;
  scaleY = 1;
  runPhase = 0;
  hurtTime = 0;
  dustTime = 0;
  jump(reduced: boolean) {
    if (!reduced) {
      this.scaleX = 0.91;
      this.scaleY = 1.1;
    }
  }
  land(speed: number, reduced: boolean) {
    if (!reduced) {
      const force = Math.min(1, speed / 650);
      this.scaleX = 1 + 0.13 * force;
      this.scaleY = 1 - 0.13 * force;
    }
  }
  hurt() {
    this.hurtTime = FEEDBACK.hurtDuration;
  }
  tick(body: Body, dt: number, reduced: boolean) {
    this.runPhase += (Math.abs(body.vx) * dt) / FEEDBACK.runStride;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.dustTime = Math.max(0, this.dustTime - dt);
    const blend = 1 - Math.exp(-FEEDBACK.settleRate * dt);
    this.scaleX += (1 - this.scaleX) * blend;
    this.scaleY += (1 - this.scaleY) * blend;
    if (reduced) this.scaleX = this.scaleY = 1;
  }
  texture(body: Body, time: number, landTime: number) {
    if (this.hurtTime > 0) return "player-hurt";
    if (!body.grounded) return body.vy < 0 ? "player-jump" : "player-fall";
    if (landTime > 0) return "player-land";
    return Math.abs(body.vx) > 20
      ? `player-run-${Math.floor(this.runPhase) % 6}`
      : `player-idle-${Math.floor(time * 4) % 4}`;
  }
}
