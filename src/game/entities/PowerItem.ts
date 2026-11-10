import Phaser from "phaser";
import type { Solid } from "../physics/motion";

/** A released leaf drifts off its block and settles where it can be collected. */
export class PowerItem {
  sprite: Phaser.GameObjects.Image;
  vx = 64;
  vy = -150;
  age = 0;
  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
  ) {
    this.sprite = scene.add.image(x, y, "power").setDepth(6);
  }
  update(dt: number, solids: Solid[]) {
    this.age += dt;
    const bottom = this.y + 10;
    this.x += this.vx * dt;
    this.vy = Math.min(450, this.vy + 900 * dt);
    this.y += this.vy * dt;
    for (const s of solids) {
      if (
        this.x + 9 > s.x &&
        this.x - 9 < s.x + s.w &&
        bottom <= s.y + 2 &&
        this.y + 10 >= s.y &&
        this.vy >= 0
      ) {
        this.y = s.y - 10;
        this.vy = 0;
        if (s.id < 1000) this.vx = 0;
      }
    }
    this.sprite.setPosition(this.x, this.y + Math.sin(this.age * 4) * 2);
  }
}
