import Phaser from "phaser";
import { saveStore } from "../systems/save";
const counts = new WeakMap<Phaser.Scene, number>();
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count = 10,
  force = 50,
): void {
  const settings = saveStore.data.settings;
  const multiplier = settings.effects === "low" ? 0.4 : 1;
  count = Math.max(
    0,
    Math.min(
      Math.ceil(count * multiplier),
      settings.reducedMotion ? 3 : 96,
      96 - (counts.get(scene) || 0),
    ),
  );
  for (let i = 0; i < count; i++) {
    const p = scene.add
      .rectangle(
        x,
        y,
        Phaser.Math.Between(2, 5),
        Phaser.Math.Between(2, 5),
        color,
      )
      .setDepth(20);
    counts.set(scene, (counts.get(scene) || 0) + 1);
    p.once("destroy", () =>
      counts.set(scene, Math.max(0, (counts.get(scene) || 0) - 1)),
    );
    const angle = Math.random() * Math.PI * 2,
      distance =
        force * (settings.reducedMotion ? 0.2 : 1) * (0.4 + Math.random());
    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance + 15,
      alpha: 0,
      angle: settings.reducedMotion ? 0 : 90,
      duration: 400 + Math.random() * 250,
      onComplete: () => p.destroy(),
    });
  }
}
