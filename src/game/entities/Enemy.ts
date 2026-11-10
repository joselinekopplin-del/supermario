import Phaser from "phaser";
import type { Solid } from "../physics/motion";
export type EnemyType = "beetle" | "hopper" | "flyer";
export class Enemy {
  sprite: Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  w = 26;
  h = 22;
  vx: number;
  vy = 0;
  alive = true;
  phase = 0;
  grounded = false;
  constructor(
    scene: Phaser.Scene,
    public origin: { x: number; y: number; type: EnemyType; range: number },
  ) {
    this.x = origin.x;
    this.y = origin.y;
    this.vx = origin.type === "beetle" ? -48 : -65;
    this.sprite = scene.add
      .sprite(this.x, this.y, `enemy-${origin.type}-0`)
      .setDepth(6);
  }
  update(dt: number, solids: Solid[]) {
    if (!this.alive) return;
    this.phase += dt;
    if (this.origin.type === "flyer") {
      this.x =
        this.origin.x + (Math.sin(this.phase * 1.5) * this.origin.range) / 2;
      this.y = this.origin.y + Math.sin(this.phase * 2.6) * 26;
    } else {
      if (this.x < this.origin.x - this.origin.range / 2)
        this.vx = Math.abs(this.vx);
      if (this.x > this.origin.x + this.origin.range / 2)
        this.vx = -Math.abs(this.vx);
      if (this.grounded) {
        const ahead = this.x + Math.sign(this.vx) * 20;
        const floor = solids.some(
          (s) =>
            ahead >= s.x &&
            ahead <= s.x + s.w &&
            Math.abs(s.y - (this.y + this.h / 2)) < 8,
        );
        if (!floor) this.vx *= -1;
      }
      this.x += this.vx * dt;
      // Resolve sides before vertical movement, matching the player's solid
      // collision rules. Patrol creatures cannot walk through raised terrain.
      for (const s of solids) {
        if (
          this.x + this.w / 2 > s.x &&
          this.x - this.w / 2 < s.x + s.w &&
          this.y + this.h / 2 > s.y + 0.1 &&
          this.y - this.h / 2 < s.y + s.h - 0.1
        ) {
          if (this.vx > 0) {
            this.x = s.x - this.w / 2;
            this.vx = -Math.abs(this.vx);
          } else if (this.vx < 0) {
            this.x = s.x + s.w + this.w / 2;
            this.vx = Math.abs(this.vx);
          }
        }
      }
      if (
        this.origin.type === "hopper" &&
        this.grounded &&
        Math.sin(this.phase * 3) > 0.98
      ) {
        this.vy = -310;
        this.grounded = false;
      }
      this.vy = Math.min(550, this.vy + 1050 * dt);
      const bottom = this.y + this.h / 2;
      const top = this.y - this.h / 2;
      this.y += this.vy * dt;
      this.grounded = false;
      for (const s of solids) {
        if (
          this.x + this.w / 2 > s.x &&
          this.x - this.w / 2 < s.x + s.w &&
          bottom <= s.y + 3 &&
          this.y + this.h / 2 >= s.y &&
          this.vy >= 0
        ) {
          this.y = s.y - this.h / 2;
          this.vy = 0;
          this.grounded = true;
        } else if (
          this.x + this.w / 2 > s.x &&
          this.x - this.w / 2 < s.x + s.w &&
          top >= s.y + s.h - 2 &&
          this.y - this.h / 2 <= s.y + s.h &&
          this.vy < 0
        ) {
          // A hopper under a platform must hit its underside, otherwise it can
          // damage a player who is safely standing on the upper surface.
          this.y = s.y + s.h + this.h / 2;
          this.vy = 0;
        }
      }
    }
    this.sprite
      .setPosition(this.x, this.y)
      .setTexture(`enemy-${this.origin.type}-${Math.floor(this.phase * 6) % 2}`)
      .setFlipX(this.vx > 0);
  }
  stomp(scene: Phaser.Scene) {
    this.alive = false;
    scene.tweens.add({
      targets: this.sprite,
      scaleY: 0.16,
      alpha: 0,
      y: this.y + 9,
      duration: 240,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
