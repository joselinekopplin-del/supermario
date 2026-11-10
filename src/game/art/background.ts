import Phaser from "phaser";
import {
  ambientDetail,
  ambientTween,
  beginWorldArt,
  type WorldArtOptions,
} from "./preferences";

export type WorldTheme = "meadow" | "cave" | "sky";

/** Painted parallax layers are cached textures, not hundreds of live objects. */
export function drawBackground(
  scene: Phaser.Scene,
  theme: WorldTheme,
  width: number,
  options: WorldArtOptions = {},
): void {
  beginWorldArt(scene, options);
  const palette =
    theme === "cave"
      ? ["#132c42", "#203e50", "#2a5160", "#356776", "#57918c"]
      : theme === "sky"
        ? ["#a6cfdf", "#f0dfbd", "#b5c9c5", "#91b6b4", "#578d93"]
        : ["#b6dce1", "#f2eccd", "#a3c4b0", "#80af9b", "#5c9985"];
  const rect = (
    c: CanvasRenderingContext2D,
    color: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const polygon = (
    c: CanvasRenderingContext2D,
    color: string,
    pts: number[][],
  ) => {
    c.fillStyle = color;
    c.beginPath();
    pts.forEach(([x, y], i) =>
      i
        ? c.lineTo(Math.round(x), Math.round(y))
        : c.moveTo(Math.round(x), Math.round(y)),
    );
    c.closePath();
    c.fill();
  };
  // Deterministic decoration, independent of gameplay and level layout.
  const noise = (n: number) => {
    const f = Math.sin(n * 127.1 + 83.73) * 43758.5453;
    return f - Math.floor(f);
  };
  const layer = (
    name: string,
    factor: number,
    paint: (c: CanvasRenderingContext2D, w: number) => void,
    depth: number,
  ) => {
    const w = Math.ceil(960 + (width - 960) * factor + 300),
      key = `bg-v2-${theme}-${name}-${w}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, w, 540)!;
      tex.context.imageSmoothingEnabled = false;
      paint(tex.context, w);
      tex.refresh();
    }
    scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setScrollFactor(factor, 0)
      .setDepth(depth);
  };
  const cloud = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    color: string,
    shade: string,
  ) => {
    polygon(c, shade, [
      [x, y + 14 * s],
      [x + 8 * s, y + 14 * s],
      [x + 8 * s, y + 7 * s],
      [x + 22 * s, y + 7 * s],
      [x + 22 * s, y],
      [x + 43 * s, y],
      [x + 43 * s, y + 5 * s],
      [x + 58 * s, y + 5 * s],
      [x + 58 * s, y + 12 * s],
      [x + 72 * s, y + 12 * s],
      [x + 72 * s, y + 21 * s],
      [x + 64 * s, y + 21 * s],
      [x + 64 * s, y + 25 * s],
      [x + 10 * s, y + 25 * s],
      [x + 10 * s, y + 22 * s],
      [x, y + 22 * s],
    ]);
    polygon(c, color, [
      [x + 3 * s, y + 14 * s],
      [x + 11 * s, y + 14 * s],
      [x + 11 * s, y + 8 * s],
      [x + 25 * s, y + 8 * s],
      [x + 25 * s, y + 2 * s],
      [x + 41 * s, y + 2 * s],
      [x + 41 * s, y + 7 * s],
      [x + 55 * s, y + 7 * s],
      [x + 55 * s, y + 15 * s],
      [x + 67 * s, y + 15 * s],
      [x + 67 * s, y + 19 * s],
      [x + 13 * s, y + 19 * s],
      [x + 13 * s, y + 17 * s],
      [x + 3 * s, y + 17 * s],
    ]);
  };
  layer(
    "wash",
    0,
    (c, w) => {
      rect(c, palette[0], 0, 0, w, 540);
      if (theme === "cave") {
        for (let y = 0; y < 540; y += 10)
          rect(c, `rgba(5,18,30,${0.22 * (1 - y / 540)})`, 0, y, w, 10);
        for (let i = 0; i < 45; i++) {
          const x = noise(i) * 960,
            y = 60 + noise(i + 100) * 390;
          rect(c, "#3d6671", x, y, 2, 2);
        }
        // Low contrast portals in the far rock imply depth without resembling platforms.
        for (let x = 100; x < w; x += 440) {
          polygon(c, "#1a394d", [
            [x, 420],
            [x, 205],
            [x + 24, 160],
            [x + 60, 141],
            [x + 100, 163],
            [x + 123, 204],
            [x + 123, 420],
          ]);
          polygon(c, "#22485a", [
            [x + 17, 420],
            [x + 17, 216],
            [x + 36, 183],
            [x + 63, 166],
            [x + 89, 185],
            [x + 108, 216],
            [x + 108, 420],
          ]);
          rect(c, "#2b5260", x + 58, 195, 6, 164);
        }
      } else {
        for (let y = 0; y < 540; y += 12)
          rect(
            c,
            `rgba(255,235,192,${(y / 540) * (theme === "sky" ? 0.48 : 0.28)})`,
            0,
            y,
            w,
            12,
          );
        if (theme === "meadow") {
          polygon(c, "rgba(255,247,207,.09)", [
            [740, 95],
            [822, 95],
            [530, 540],
            [275, 540],
          ]);
          polygon(c, "rgba(255,247,207,.07)", [
            [760, 95],
            [815, 95],
            [950, 540],
            [800, 540],
          ]);
        }
        // A soft luminous pixel sun, deliberately restrained.
        rect(c, "#dce6c8", 731, 58, 62, 6);
        rect(c, "#dce6c8", 725, 64, 74, 54);
        rect(c, "#dce6c8", 731, 118, 62, 6);
        rect(c, "#f8edbd", 738, 65, 48, 6);
        rect(c, "#f8edbd", 732, 71, 60, 41);
        rect(c, "#f8edbd", 738, 112, 48, 6);
        rect(c, "#fff1c7", 742, 70, 40, 41);
      }
    },
    -40,
  );
  layer(
    "far",
    0.08,
    (c, w) => {
      if (theme === "cave") {
        for (let x = -100; x < w; x += 170) {
          const h = 90 + noise(x) * 150;
          polygon(c, "#1c3549", [
            [x, 0],
            [x + 120, 0],
            [x + 103, h * 0.4],
            [x + 85, h * 0.4],
            [x + 70, h],
            [x + 50, h * 0.65],
            [x + 37, h * 0.65],
          ]);
        }
        for (let x = 0; x < w; x += 240) {
          rect(c, "#1e3e51", x + 30, 200, 62, 340);
          rect(c, "#244958", x + 40, 217, 40, 323);
          rect(c, "#193449", x + 33, 212, 58, 12);
          rect(c, "#193449", x + 24, 198, 74, 15);
          rect(c, "#315465", x + 32, 198, 60, 3);
          rect(c, "#355c68", x + 52, 230, 5, 230);
          rect(c, "#355c68", x + 68, 230, 3, 230);
        }
      } else {
        for (let x = -40, i = 0; x < w; x += 220, i++)
          cloud(
            c,
            x,
            54 + noise(i) * 105,
            1.1 + noise(i + 5),
            "#f4f0d9",
            "#dae4d2",
          );
        for (let x = -100; x < w; x += 350) {
          if (theme === "sky") {
            const y = 225 + noise(x) * 75;
            polygon(c, "#a1bec2", [
              [x, y],
              [x + 110, y],
              [x + 93, y + 19],
              [x + 76, y + 33],
              [x + 64, y + 66],
              [x + 49, y + 41],
              [x + 27, y + 25],
            ]);
            rect(c, "#c7d3bd", x + 4, y - 3, 101, 5);
            rect(c, "#b5c8be", x + 32, y - 47, 18, 44);
            rect(c, "#d3dac3", x + 29, y - 51, 24, 5);
            rect(c, "#8faeb6", x + 37, y - 36, 7, 14);
            cloud(c, x + 22, y + 75, 2.5, "#e4e6d8", "#c6d8d5");
            continue;
          }
          const peak = 185 + noise(x) * 50;
          polygon(c, palette[2], [
            [x - 80, 440],
            [x + 40, peak + 60],
            [x + 55, peak + 60],
            [x + 120, peak],
            [x + 140, peak],
            [x + 260, peak + 120],
            [x + 380, 440],
          ]);
          polygon(c, "#bbd0ba", [
            [x + 55, peak + 60],
            [x + 120, peak],
            [x + 140, peak],
            [x + 195, peak + 66],
            [x + 143, peak + 42],
            [x + 130, peak + 28],
            [x + 109, peak + 57],
            [x + 88, peak + 51],
          ]);
        }
      }
    },
    -35,
  );
  layer(
    "middle",
    0.2,
    (c, w) => {
      if (theme === "cave") {
        for (let x = -60; x < w; x += 190) {
          const y = 140 + noise(x) * 70;
          polygon(c, "#274b59", [
            [x, 540],
            [x + 20, y + 100],
            [x + 55, y + 100],
            [x + 64, y],
            [x + 91, y + 64],
            [x + 115, y + 64],
            [x + 145, 540],
          ]);
          polygon(c, "#315968", [
            [x + 64, y],
            [x + 70, 540],
            [x + 117, 540],
            [x + 91, y + 64],
          ]);
          rect(c, "#436b72", x + 62, y + 15, 4, 90);
        }
        for (let x = 120; x < w; x += 340) {
          rect(c, "#4a777a", x, 285, 8, 160);
          rect(c, "#356367", x - 10, 286, 8, 150);
          rect(c, "#67918a", x + 10, 286, 3, 132);
          rect(c, "#284d5d", x - 12, 275, 30, 12);
        }
      } else if (theme === "sky") {
        for (let x = -140; x < w; x += 390) {
          cloud(c, x, 310 + noise(x) * 50, 3.4, "#e7ead6", "#c7dbcd");
          rect(c, "#85aba4", x + 120, 185, 54, 112);
          rect(c, "#a8c0ae", x + 127, 180, 41, 117);
          polygon(c, "#7faaa2", [
            [x + 114, 188],
            [x + 147, 140],
            [x + 181, 188],
          ]);
          rect(c, "#668e8b", x + 140, 207, 13, 22);
          rect(c, "#668e8b", x + 140, 245, 13, 22);
          rect(c, "#8aaea3", x + 175, 236, 76, 61);
          rect(c, "#c2d1b6", x + 178, 233, 70, 5);
          for (let j = 0; j < 4; j++)
            rect(c, "#b1c5ae", x + 177 + j * 19, 224, 11, 13);
        }
        // Distant rope bridges connect the old towers, purely in the parallax layer.
        for (let x = 160; x < w; x += 780) {
          for (let j = 0; j < 14; j++) {
            const yy = 276 + Math.round(Math.sin((j / 13) * Math.PI) * 17);
            rect(c, "#82a79b", x + j * 9, yy, 8, 3);
            rect(c, "#a2bba6", x + j * 9, yy - 18, 10, 2);
            if (j % 2 === 0) rect(c, "#8eae9d", x + j * 9 + 2, yy - 16, 2, 16);
          }
          rect(c, "#8baa99", x - 2, 251, 4, 29);
          rect(c, "#8baa99", x + 124, 251, 4, 29);
        }
      } else {
        for (let x = -130; x < w; x += 260) {
          const peak = 280 + noise(x) * 70;
          polygon(c, palette[3], [
            [x, 540],
            [x, peak + 80],
            [x + 22, peak + 80],
            [x + 22, peak + 50],
            [x + 52, peak + 50],
            [x + 52, peak + 20],
            [x + 100, peak + 20],
            [x + 100, peak],
            [x + 155, peak],
            [x + 155, peak + 15],
            [x + 190, peak + 15],
            [x + 190, peak + 40],
            [x + 230, peak + 40],
            [x + 270, 540],
          ]);
          rect(c, "#9bbfa2", x + 105, peak, 47, 5);
          rect(c, "#9bbfa2", x + 55, peak + 20, 45, 4);
        }
        for (let x = 130; x < w; x += 430) {
          rect(c, "#789f91", x, 291, 12, 180);
          rect(c, "#94b59b", x + 3, 291, 3, 180);
          polygon(c, "#6fa58e", [
            [x - 37, 349],
            [x - 37, 316],
            [x - 25, 316],
            [x - 25, 288],
            [x - 11, 288],
            [x - 11, 270],
            [x + 18, 270],
            [x + 18, 289],
            [x + 36, 289],
            [x + 36, 320],
            [x + 48, 320],
            [x + 48, 349],
          ]);
          rect(c, "#a0c098", x - 11, 270, 27, 5);
          rect(c, "#92ba97", x - 25, 290, 55, 9);
          for (let j = 0; j < 6; j++) {
            const xx = x - 20 + noise(x + j) * 58,
              yy = 300 + noise(x + j + 9) * 39;
            rect(c, j % 2 ? "#8db798" : "#79aa8e", xx, yy, 7, 3);
          }
        }
        for (let x = 460; x < w; x += 850) {
          // Hollow, moss-covered log channels echo the ancient forest architecture.
          polygon(c, "#6e9580", [
            [x, 435],
            [x, 397],
            [x + 8, 383],
            [x + 22, 377],
            [x + 44, 377],
            [x + 59, 386],
            [x + 65, 399],
            [x + 65, 435],
            [x + 51, 435],
            [x + 51, 402],
            [x + 44, 393],
            [x + 31, 389],
            [x + 19, 395],
            [x + 14, 406],
            [x + 14, 435],
          ]);
          rect(c, "#a5bb8e", x + 21, 378, 24, 5);
          rect(c, "#8fb089", x + 9, 385, 17, 4);
          rect(c, "#83a580", x + 54, 398, 4, 25);
          rect(c, "#bad09e", x + 23, 378, 14, 2);
          rect(c, "#87a781", x + 1, 402, 3, 30);
          for (let j = 0; j < 11; j++) {
            const yy = 409 + Math.round(Math.sin((j / 10) * Math.PI) * 10);
            rect(c, "#789782", x + 90 + j * 9, yy, 8, 3);
            rect(c, "#98b196", x + 90 + j * 9, yy - 16, 10, 2);
            if (j % 2 === 0) rect(c, "#7c9c84", x + 92 + j * 9, yy - 14, 2, 14);
          }
          rect(c, "#70967e", x + 88, 388, 4, 25);
          rect(c, "#70967e", x + 180, 388, 4, 25);
        }
      }
    },
    -30,
  );
  layer(
    "near",
    0.43,
    (c, w) => {
      if (theme === "cave") {
        for (let x = -60; x < w; x += 230) {
          const h = 30 + noise(x) * 50;
          polygon(c, "#132f40", [
            [x, 0],
            [x + 140, 0],
            [x + 100, h],
            [x + 75, h * 0.6],
            [x + 58, h + 25],
            [x + 35, h * 0.4],
          ]);
          const yy = 385 + noise(x + 1) * 25;
          polygon(c, "#386d72", [
            [x + 30, 480],
            [x + 31, yy + 30],
            [x + 45, yy],
            [x + 55, yy + 22],
            [x + 58, 480],
          ]);
          polygon(c, "#65a7a0", [
            [x + 34, yy + 30],
            [x + 45, yy],
            [x + 45, 470],
            [x + 37, 470],
          ]);
          polygon(c, "#91c3aa", [
            [x + 35, yy + 30],
            [x + 44, yy + 3],
            [x + 41, yy + 60],
          ]);
          polygon(c, "#397980", [
            [x + 54, 480],
            [x + 61, yy + 40],
            [x + 75, yy + 26],
            [x + 78, yy + 42],
            [x + 67, 480],
          ]);
          rect(c, "#b2d6b7", x + 44, yy + 2, 2, 8);
        }
      } else if (theme === "sky") {
        for (let x = -70; x < w; x += 280)
          cloud(c, x, 430 + noise(x) * 26, 4.2, "#f5eed7", "#dae1c9");
        for (let x = 300; x < w; x += 570) {
          const y = 260 + noise(x) * 50;
          polygon(c, "#709e98", [
            [x, y],
            [x + 108, y],
            [x + 84, y + 25],
            [x + 73, y + 62],
            [x + 57, y + 82],
            [x + 44, y + 41],
            [x + 22, y + 31],
          ]);
          rect(c, "#a4bfa6", x, y - 5, 108, 7);
          rect(c, "#d9dbb4", x + 3, y - 5, 99, 3);
          rect(c, "#b3c4a8", x + 35, y - 47, 12, 42);
          rect(c, "#d7d8b5", x + 36, y - 47, 4, 41);
          rect(c, "#a7bda0", x + 30, y - 51, 23, 5);
          rect(c, "#8cac9b", x + 38, y + 13, 2, 25);
          rect(c, "#8cac9b", x + 75, y + 10, 2, 26);
        }
      } else {
        for (let x = -60; x < w; x += 130) {
          const y = 427 + noise(x) * 20;
          polygon(c, "#629985", [
            [x, y + 70],
            [x, y + 18],
            [x + 14, y + 18],
            [x + 14, y + 7],
            [x + 33, y + 7],
            [x + 33, y],
            [x + 57, y],
            [x + 57, y + 8],
            [x + 77, y + 8],
            [x + 77, y + 20],
            [x + 94, y + 20],
            [x + 110, y + 70],
          ]);
          rect(c, "#8bb392", x + 34, y, 21, 3);
          rect(c, "#81ad8b", x + 16, y + 9, 17, 3);
        }
        for (let x = 70; x < w; x += 280) {
          rect(c, "#58917b", x, 390, 4, 75);
          rect(c, "#a6c598", x - 2, 380, 8, 7);
          rect(c, "#e7d6a6", x - 3, 379, 9, 3);
          rect(c, "#6fa087", x - 6, 417, 7, 3);
          rect(c, "#6fa087", x + 4, 406, 7, 3);
        }
      }
    },
    -25,
  );
  // Reusable small cloud silhouettes drift independently from the mountains.
  if (theme !== "cave") {
    const key = `ambient-cloud-${theme}`;
    if (!scene.textures.exists(key)) {
      const texture = scene.textures.createCanvas(key, 160, 60)!;
      cloud(
        texture.context,
        4,
        6,
        1.9,
        theme === "sky" ? "#f5ecd6" : "#fff2d8",
        theme === "sky" ? "#d4dfd2" : "#e1e6ce",
      );
      texture.refresh();
    }
    for (let i = 0; i < 3; i++) {
      const x = 110 + i * 335;
      const drift = ambientDetail(
        scene,
        scene.add
          .image(x, 125 + (i % 2) * 70, key)
          .setScrollFactor(0.045, 0)
          .setAlpha(0.6)
          .setDepth(-34),
      );
      ambientTween(scene, {
        targets: drift,
        x: x + 70,
        duration: 32000 + i * 5000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
  // Small ambient motes use a bounded count; no unbounded emitter allocation.
  for (let i = 0; i < 10; i++) {
    const mote = ambientDetail(
      scene,
      scene.add
        .rectangle(
          noise(i + 50) * 960,
          80 + noise(i + 90) * 380,
          2,
          2,
          theme === "cave" ? 0xa9dfb1 : 0xfff4d3,
          0.45,
        )
        .setScrollFactor(0)
        .setDepth(-20),
    );
    ambientTween(scene, {
      targets: mote,
      y: mote.y - 15 - noise(i + 70) * 18,
      alpha: 0.08,
      duration: 2300 + noise(i) * 3600,
      delay: i * 190,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
