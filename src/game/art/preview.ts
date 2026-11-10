import Phaser from "phaser";
import { ambientTween, worldMotionEnabled } from "./preferences";

/** The title-screen illustration is independent of every playable collision body. */
export function drawMenuVignette(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(5);
  const r = (color: number, x: number, y: number, w: number, h: number) => {
    g.fillStyle(color);
    g.fillRect(x, y, w, h);
  };
  const poly = (color: number, points: number[][]) => {
    g.fillStyle(color);
    g.fillPoints(
      points.map(([x, y]) => new Phaser.Geom.Point(x, y)),
      true,
    );
  };
  // A little drifting garden; jagged facets retain the same pixel vocabulary.
  poly(0x426d60, [
    [617, 375],
    [901, 375],
    [901, 389],
    [884, 389],
    [884, 403],
    [854, 403],
    [854, 418],
    [826, 418],
    [826, 437],
    [798, 437],
    [798, 449],
    [773, 449],
    [773, 439],
    [746, 439],
    [746, 426],
    [718, 426],
    [718, 415],
    [687, 415],
    [687, 402],
    [649, 402],
    [649, 390],
    [617, 390],
  ]);
  poly(0x86977a, [
    [622, 377],
    [892, 377],
    [884, 389],
    [854, 389],
    [854, 403],
    [825, 403],
    [825, 420],
    [800, 420],
    [800, 431],
    [773, 431],
    [773, 421],
    [746, 421],
    [746, 411],
    [718, 411],
    [718, 397],
    [651, 397],
    [651, 385],
    [622, 385],
  ]);
  poly(0x667d65, [
    [741, 380],
    [782, 380],
    [782, 393],
    [799, 393],
    [799, 425],
    [780, 437],
    [766, 419],
    [748, 411],
  ]);
  r(0xa1ac85, 637, 382, 37, 5);
  r(0xa1ac85, 814, 385, 47, 4);
  r(0xa1ac85, 711, 399, 23, 4);
  r(0x466c58, 837, 398, 3, 15);
  r(0x345b49, 615, 369, 290, 9);
  r(0x6b9f65, 619, 364, 281, 11);
  r(0xb5ce86, 625, 361, 268, 6);
  r(0xe0e8af, 635, 361, 249, 2);
  for (let x = 625; x < 895; x += 16) {
    r(0x89b176, x, 373, 8, 4 + (x % 7));
    r(0xb5ce86, x + 3, 365, 5, 2);
  }
  // Draping vines on the broken island edges.
  for (const [x, y, h] of [
    [655, 380, 24],
    [858, 379, 28],
    [835, 409, 18],
    [697, 402, 25],
  ]) {
    r(0x4c825f, x, y, 3, h);
    r(0x8bb67e, x - 4, y + 5, 7, 3);
    r(0x76a270, x + 2, y + 13, 8, 3);
    r(0xa9c88d, x - 2, y + 5, 3, 1);
  }
  // Mossy old hollow wood is the explorer's resting place.
  poly(0x4e6750, [
    [648, 362],
    [648, 326],
    [655, 316],
    [671, 309],
    [695, 309],
    [709, 317],
    [715, 332],
    [715, 362],
    [701, 362],
    [701, 336],
    [696, 327],
    [683, 324],
    [670, 328],
    [665, 338],
    [665, 362],
  ]);
  poly(0x9a9972, [
    [652, 360],
    [652, 328],
    [659, 320],
    [673, 314],
    [693, 314],
    [704, 322],
    [710, 334],
    [710, 360],
    [705, 360],
    [705, 333],
    [698, 324],
    [683, 320],
    [668, 325],
    [661, 336],
    [661, 360],
  ]);
  r(0xc0bd8b, 673, 314, 18, 3);
  r(0x6f9560, 654, 319, 14, 5);
  r(0x87ac6d, 663, 312, 28, 6);
  r(0xb2ca83, 668, 312, 18, 2);
  r(0x73925e, 702, 332, 4, 19);
  r(0x54694d, 655, 335, 2, 19);
  r(0xd0c69a, 657, 332, 1, 18);
  // Fine foreground reeds and leaves frame the protagonist.
  for (const [x, y, h] of [
    [632, 360, 24],
    [890, 360, 30],
    [881, 362, 17],
    [727, 361, 13],
  ]) {
    r(0x3e7154, x, y - h, 3, h);
    r(0x63905b, x - 8, y - h + 8, 10, 4);
    r(0x88b271, x + 3, y - h + 3, 9, 4);
    r(0xb8cd89, x + 4, y - h + 3, 5, 1);
  }
  const hero = scene.add
    .sprite(758, 307, "player-idle-0")
    .setScale(3)
    .setScrollFactor(0)
    .setDepth(7);
  let frame = 0;
  scene.time.addEvent({
    delay: 230,
    loop: true,
    callback: () => {
      if (worldMotionEnabled(scene))
        hero.setTexture(`player-idle-${frame++ % 4}`);
    },
  });
  scene.add
    .image(842, 364, "checkpoint")
    .setOrigin(0.5, 1)
    .setScale(1.35)
    .setScrollFactor(0)
    .setDepth(6);
  for (const [x, y, s] of [
    [707, 361, 1.6],
    [812, 361, 1.4],
    [876, 361, 1.7],
  ])
    scene.add
      .image(x, y, "flower")
      .setScale(s)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(6);
  const companion = scene.add
    .image(826, 254, "enemy-flyer-0")
    .setScale(1.6)
    .setScrollFactor(0)
    .setDepth(7);
  scene.time.addEvent({
    delay: 150,
    loop: true,
    callback: () => {
      if (worldMotionEnabled(scene))
        companion.setTexture(`enemy-flyer-${frame % 2}`);
    },
  });
  ambientTween(scene, {
    targets: companion,
    y: 244,
    x: 835,
    duration: 1700,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  for (const [x, y] of [
    [715, 276],
    [869, 289],
    [787, 225],
    [895, 332],
  ]) {
    const star = scene.add
      .image(x, y, "spark")
      .setScale(1.2)
      .setScrollFactor(0)
      .setDepth(6)
      .setAlpha(0.8);
    ambientTween(scene, {
      targets: star,
      alpha: 0.15,
      y: y - 7,
      duration: 1700 + x,
      delay: x,
      yoyo: true,
      repeat: -1,
    });
  }
}
