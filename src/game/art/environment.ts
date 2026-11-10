import Phaser from "phaser";
import type { Level, Rect, Theme } from "../levels";
import {
  ambientDetail,
  ambientTween,
  type WorldArtOptions,
} from "./preferences";

function accentTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("world-glow")) return;
  const texture = (
    key: string,
    w: number,
    h: number,
    paint: (c: CanvasRenderingContext2D) => void,
  ) => {
    const t = scene.textures.createCanvas(key, w, h)!;
    t.context.imageSmoothingEnabled = false;
    paint(t.context);
    t.refresh();
  };
  texture("world-glow", 128, 128, (c) => {
    // Stepped, very soft rings preserve the pixel vocabulary without postprocessing.
    for (let r = 60; r >= 8; r -= 6) {
      c.fillStyle = "rgba(174,234,204,.035)";
      for (let y = -r; y <= r; y += 4) {
        const half = Math.floor(Math.sqrt(r * r - y * y) / 4) * 4;
        c.fillRect(64 - half, 64 + y, half * 2, 4);
      }
    }
  });
  texture("world-reeds", 24, 36, (c) => {
    c.fillStyle = "#426c4d";
    c.fillRect(8, 10, 2, 26);
    c.fillRect(15, 3, 2, 33);
    c.fillStyle = "#74a064";
    c.fillRect(3, 18, 6, 3);
    c.fillRect(10, 13, 5, 3);
    c.fillRect(17, 10, 5, 3);
    c.fillRect(11, 23, 6, 3);
    c.fillStyle = "#bbd38e";
    c.fillRect(4, 17, 4, 1);
    c.fillRect(18, 9, 4, 1);
    c.fillStyle = "#e9d4a0";
    c.fillRect(14, 1, 4, 8);
    c.fillRect(7, 7, 4, 7);
    c.fillStyle = "#fff0c7";
    c.fillRect(14, 1, 2, 6);
    c.fillRect(7, 7, 2, 5);
  });
  texture("world-crystal", 32, 52, (c) => {
    const poly = (color: string, pts: number[][]) => {
      c.fillStyle = color;
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
    };
    poly("#28525e", [
      [7, 50],
      [4, 23],
      [12, 4],
      [20, 20],
      [18, 50],
    ]);
    poly("#5daca8", [
      [8, 47],
      [7, 25],
      [12, 8],
      [15, 22],
      [14, 48],
    ]);
    poly("#abdbc1", [
      [8, 26],
      [12, 8],
      [12, 38],
    ]);
    poly("#397c87", [
      [17, 50],
      [18, 32],
      [27, 21],
      [29, 34],
      [25, 50],
    ]);
    poly("#80c3bc", [
      [20, 33],
      [26, 24],
      [24, 44],
    ]);
    c.fillStyle = "#d1ebce";
    c.fillRect(11, 12, 1, 9);
    c.fillStyle = "#1e4554";
    c.fillRect(3, 48, 27, 4);
  });
  texture("world-banner", 24, 72, (c) => {
    c.fillStyle = "#5a7770";
    c.fillRect(2, 0, 3, 72);
    c.fillRect(2, 5, 21, 3);
    c.fillStyle = "#b9b985";
    c.fillRect(3, 1, 1, 70);
    c.fillStyle = "#bc9870";
    c.fillRect(7, 9, 14, 35);
    c.fillRect(7, 43, 5, 8);
    c.fillRect(16, 43, 5, 8);
    c.fillStyle = "#ebd39a";
    c.fillRect(8, 9, 12, 3);
    c.fillRect(10, 19, 8, 2);
    c.fillRect(13, 16, 2, 13);
    c.fillStyle = "#8c7860";
    c.fillRect(19, 12, 2, 30);
  });
  texture("world-end-arch", 300, 220, (c) => {
    const rect = (
      color: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    for (let i = 0; i < 5; i++)
      rect(
        `rgba(250,231,162,${0.015 + i * 0.003})`,
        62 + i * 12,
        9 + i * 9,
        176 - i * 24,
        210 - i * 9,
      );
    for (const x of [35, 245]) {
      rect("#6d9690", x, 86, 21, 134);
      rect("#b5c5ac", x + 3, 88, 14, 132);
      rect("#e0dbb2", x + 4, 90, 3, 130);
      rect("#879e8a", x + 15, 90, 3, 130);
      rect("#92afa1", x - 5, 83, 31, 8);
      rect("#d6d9b2", x - 3, 83, 27, 3);
      for (let y = 103; y < 220; y += 24) {
        rect("#8aa493", x + 3, y, 14, 2);
        rect("#c5ceb0", x + 8, y + 6, 3, 8);
      }
    }
    rect("#a2b8a3", 39, 74, 223, 7);
    rect("#e0dcad", 41, 74, 218, 2);
    rect("#b3c4a8", 79, 56, 143, 7);
    rect("#e0dcad", 81, 56, 139, 2);
    rect("#a8bda4", 117, 38, 68, 7);
    rect("#e7dfae", 119, 38, 64, 3);
    rect("#cbcc9f", 144, 12, 12, 30);
    rect("#edf0c2", 148, 7, 4, 30);
    rect("#e1d6a4", 137, 19, 26, 4);
    rect("#fff0be", 146, 17, 8, 8);
  });
}

/** Scenic accents never create collision bodies. Functional paths stay visually stronger. */
export function drawWorldAccents(
  scene: Phaser.Scene,
  level: Level,
  _options: WorldArtOptions = {},
) {
  accentTextures(scene);
  const track = scene.add.graphics().setDepth(1.7);
  for (const p of level.platforms) {
    if (p.move) {
      const vertical = p.move.axis === "y",
        distance = Math.abs(p.move.distance);
      const x = p.x + p.w / 2,
        y = p.y + p.h / 2;
      track.fillStyle(0xa4c8b6, 0.38);
      for (let i = -distance; i <= distance; i += 8)
        track.fillRect(
          x + (vertical ? 0 : i) - 1,
          y + (vertical ? i : 0) - 1,
          2,
          2,
        );
      track.lineStyle(1, 0xcbd7b5, 0.55);
      for (const end of [-distance, distance])
        track.strokeCircle(
          x + (vertical ? 0 : end),
          y + (vertical ? end : 0),
          3,
        );
    }
  }
  const ground = level.platforms.filter((p) => !p.move && p.h > 32);
  ground.forEach((p, i) => {
    if (level.theme === "meadow") {
      for (let n = 0; n < 2; n++) {
        const x = p.x + 80 + n * Math.min(280, p.w * 0.5);
        const plant = ambientDetail(
          scene,
          scene.add
            .image(x, p.y, "world-reeds")
            .setOrigin(0.5, 1)
            .setDepth(2.7),
        );
        ambientTween(scene, {
          targets: plant,
          angle: n ? 3 : -3,
          duration: 1900 + i * 170,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else if (level.theme === "cave") {
      const x = p.x + Math.min(95, p.w * 0.3);
      const glow = ambientDetail(
        scene,
        scene.add
          .image(x, p.y - 30, "world-glow")
          .setDepth(1.3)
          .setAlpha(0.34),
      );
      scene.add.image(x, p.y, "world-crystal").setOrigin(0.5, 1).setDepth(2.3);
      ambientTween(scene, {
        targets: glow,
        alpha: 0.2,
        duration: 2400 + i * 170,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      const banner = ambientDetail(
        scene,
        scene.add
          .image(p.x + 35, p.y, "world-banner")
          .setOrigin(0.5, 1)
          .setDepth(2),
      );
      ambientTween(scene, {
        targets: banner,
        scaleX: 0.9,
        duration: 1300 + i * 130,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  });
  for (const chest of level.chests) {
    const glow = ambientDetail(
      scene,
      scene.add
        .image(chest.x, chest.y, "world-glow")
        .setScale(0.65)
        .setAlpha(0.25)
        .setDepth(2),
    );
    ambientTween(scene, {
      targets: glow,
      alpha: 0.12,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
  if (level.theme === "sky") {
    scene.add
      .image(level.goal.x, level.goal.y, "world-end-arch")
      .setOrigin(0.5, 1)
      .setDepth(1);
    for (const offset of [-95, 95])
      scene.add
        .image(level.goal.x + offset, level.goal.y, "world-banner")
        .setOrigin(0.5, 1)
        .setScale(1.2)
        .setDepth(2);
  }
  const goalGlow = ambientDetail(
    scene,
    scene.add
      .image(level.goal.x, level.goal.y - 48, "world-glow")
      .setScale(level.id === 3 ? 1.5 : 1)
      .setAlpha(0.25)
      .setDepth(2),
  );
  ambientTween(scene, {
    targets: goalGlow,
    alpha: 0.14,
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/** Warm coral traps are distinct from the decorative cool, translucent crystals. */
export function drawHazards(
  scene: Phaser.Scene,
  hazards: Rect[],
  _theme: Theme,
) {
  const g = scene.add.graphics().setDepth(5);
  for (const h of hazards) {
    g.fillStyle(0x643f46);
    g.fillRect(h.x - 2, h.y + h.h - 3, h.w + 4, 5);
    for (let x = h.x; x < h.x + h.w; x += 16) {
      const right = Math.min(x + 16, h.x + h.w),
        mid = (x + right) / 2;
      g.fillStyle(0x6b4049);
      g.fillTriangle(x, h.y + h.h, mid, h.y - 1, right, h.y + h.h);
      g.fillStyle(0xd58271);
      g.fillTriangle(
        x + 2,
        h.y + h.h - 1,
        mid,
        h.y + 2,
        right - 2,
        h.y + h.h - 1,
      );
      g.fillStyle(0xffd2a4);
      g.fillTriangle(
        mid,
        h.y + 2,
        mid,
        h.y + h.h - 1,
        right - 2,
        h.y + h.h - 1,
      );
    }
    g.fillStyle(0xe3ac81);
    g.fillRect(h.x, h.y + h.h - 2, h.w, 1);
  }
}
