import Phaser from "phaser";

/** Original pixel artwork. Every sprite is painted on an integer grid at runtime. */
type Paint = (ctx: CanvasRenderingContext2D) => void;
const P = {
  ink: "#173b38",
  deep: "#285446",
  green: "#4a8c61",
  leaf: "#8fc979",
  light: "#d7e5a1",
  face: "#f5d9ac",
  shade: "#d99c75",
  scarf: "#ec966b",
  red: "#bf6656",
  cream: "#fff1cc",
  gold: "#e4b45d",
};

export function generateTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("player-idle-0")) return;
  const texture = (key: string, w: number, h: number, paint: Paint) => {
    const t = scene.textures.createCanvas(key, w, h)!;
    const c = t.context;
    c.imageSmoothingEnabled = false;
    paint(c);
    t.refresh();
  };
  const rect = (
    c: CanvasRenderingContext2D,
    color: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const poly = (
    c: CanvasRenderingContext2D,
    color: string,
    points: number[][],
  ) => {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fill();
  };

  const player =
    (pose: string, frame: number): Paint =>
    (c) => {
      const running = pose === "run";
      const air = pose === "jump" || pose === "fall";
      const squat = pose === "land";
      const happy = pose === "celebrate";
      const bob = squat
        ? 1
        : running
          ? [0, -1, -2, -1, 0, 1][frame]
          : pose === "idle" && frame > 1
            ? 1
            : 0;
      c.save();
      c.translate(0, bob);
      // A scarf tails behind the explorer; movement is visible even at small scales.
      const tail = running ? [0, 1, 2, 1, 0, -1][frame] : 0;
      poly(c, P.ink, [
        [8, 23],
        [4, 22 + tail],
        [1, 24 + tail],
        [2, 28 + tail],
        [9, 27],
      ]);
      poly(c, P.scarf, [
        [9, 24],
        [4, 24 + tail],
        [2, 25 + tail],
        [3, 27 + tail],
        [9, 26],
      ]);
      // Backpack and body silhouette.
      rect(c, P.ink, 6, 23, 6, 10);
      rect(c, "#ac7751", 7, 24, 5, 8);
      rect(c, P.gold, 8, 24, 3, 2);
      rect(c, P.ink, 10, 24, 13, 11);
      rect(c, P.green, 11, 26, 10, 8);
      rect(c, P.leaf, 12, 27, 3, 6);
      rect(c, P.deep, 19, 28, 3, 7);
      rect(c, P.gold, 10, 32, 12, 2);
      rect(c, P.cream, 16, 32, 2, 2);
      // Boots: six distinct stride poses.
      const stride = running ? [-3, -1, 2, 3, 1, -2][frame] : 0;
      if (air) {
        rect(c, P.ink, 10, 33, 5, 5);
        rect(c, P.ink, 20, 31, 6, 5);
        rect(c, "#9c6e50", 11, 34, 3, 3);
        rect(c, "#9c6e50", 22, 32, 3, 3);
      } else {
        rect(c, P.ink, 10 - stride, 34, 5, 4);
        rect(c, P.ink, 18 + stride, 34, 6, 4);
        rect(c, "#9c6e50", 11 - stride, 34, 3, 3);
        rect(c, "#9c6e50", 19 + stride, 34, 4, 3);
        rect(c, P.light, 10 - stride, 37, 5, 1);
        rect(c, P.light, 18 + stride, 37, 6, 1);
      }
      // Gesturing arms have a dark one-pixel outline.
      if (happy || pose === "jump") {
        rect(c, P.ink, 5, 21, 5, 7);
        rect(c, P.green, 6, 22, 3, 4);
        rect(c, P.face, 6, 20, 3, 3);
        rect(c, P.ink, 22, 19, 5, 9);
        rect(c, P.green, 23, 22, 3, 5);
        rect(c, P.face, 23, 19, 3, 3);
      } else {
        const swing = running ? Math.round(stride / 2) : 0;
        rect(c, P.ink, 21 + swing, 26, 5, 7);
        rect(c, P.green, 22 + swing, 27, 3, 3);
        rect(c, P.face, 22 + swing, 30, 3, 3);
      }
      // Sprout hood: deliberately unlike any existing platform-game character.
      poly(c, P.ink, [
        [8, 9],
        [10, 6],
        [14, 5],
        [14, 2],
        [17, 1],
        [20, 2],
        [19, 5],
        [23, 7],
        [25, 11],
        [26, 21],
        [23, 25],
        [10, 25],
        [7, 21],
        [6, 14],
      ]);
      poly(c, P.green, [
        [9, 10],
        [12, 7],
        [19, 7],
        [23, 10],
        [24, 20],
        [21, 24],
        [11, 24],
        [8, 20],
        [8, 13],
      ]);
      poly(c, P.leaf, [
        [9, 10],
        [12, 8],
        [19, 8],
        [22, 10],
        [21, 12],
        [12, 12],
        [10, 16],
        [8, 16],
      ]);
      rect(c, P.light, 11, 9, 6, 1);
      rect(c, P.deep, 8, 18, 3, 5);
      rect(c, P.deep, 22, 13, 2, 9);
      // One growing leaf, lit on its upper edge.
      poly(c, P.green, [
        [16, 6],
        [13, 4],
        [12, 1],
        [17, 1],
        [20, 2],
        [19, 4],
      ]);
      rect(c, P.leaf, 13, 1, 4, 2);
      rect(c, P.light, 14, 1, 2, 1);
      rect(c, P.deep, 16, 3, 1, 4);
      // Warm, expressive face inset into the hood.
      poly(c, P.ink, [
        [13, 12],
        [21, 12],
        [23, 14],
        [23, 21],
        [21, 23],
        [13, 23],
        [11, 21],
        [11, 15],
      ]);
      rect(c, P.face, 13, 13, 8, 9);
      rect(c, P.face, 12, 15, 10, 5);
      rect(c, P.shade, 12, 20, 9, 2);
      rect(c, P.cream, 14, 13, 6, 2);
      if (pose === "hurt") {
        rect(c, P.ink, 14, 16, 2, 1);
        rect(c, P.ink, 19, 17, 2, 1);
        rect(c, P.ink, 17, 20, 2, 1);
      } else if (happy || (pose === "idle" && frame === 3)) {
        rect(c, P.ink, 14, 17, 2, 1);
        rect(c, P.ink, 19, 17, 2, 1);
        if (happy) rect(c, P.ink, 17, 20, 2, 1);
      } else {
        rect(c, P.ink, 15, 16, 2, 3);
        rect(c, P.ink, 20, 16, 2, 3);
        rect(c, P.cream, 15, 16, 1, 1);
        rect(c, P.cream, 20, 16, 1, 1);
      }
      rect(c, "#e7a18b", 13, 19, 2, 1);
      rect(c, "#e7a18b", 21, 19, 1, 1);
      rect(c, P.red, 10, 23, 13, 3);
      rect(c, P.scarf, 11, 23, 11, 2);
      rect(c, P.cream, 19, 23, 2, 1);
      c.restore();
    };
  for (let i = 0; i < 4; i++)
    texture(`player-idle-${i}`, 32, 40, player("idle", i));
  for (let i = 0; i < 6; i++)
    texture(`player-run-${i}`, 32, 40, player("run", i));
  for (const pose of ["jump", "fall", "land", "hurt"])
    texture(`player-${pose}`, 32, 40, player(pose, 0));
  for (let i = 0; i < 4; i++)
    texture(`player-celebrate-${i}`, 32, 40, player("celebrate", i));

  for (let f = 0; f < 2; f++) {
    texture(`enemy-beetle-${f}`, 32, 24, (c) => {
      for (const x of [5, 12, 21]) {
        rect(c, "#243e3e", x + f * 2, 19, 4, 4);
        rect(c, "#547466", x + f * 2, 20, 2, 2);
      }
      poly(c, "#493e43", [
        [3, 17],
        [4, 11],
        [7, 6],
        [12, 3],
        [21, 3],
        [26, 7],
        [28, 14],
        [28, 19],
        [22, 21],
        [8, 21],
      ]);
      poly(c, "#b86350", [
        [5, 16],
        [6, 11],
        [10, 6],
        [14, 4],
        [21, 5],
        [25, 9],
        [26, 17],
        [22, 19],
        [9, 19],
      ]);
      poly(c, "#ea9d68", [
        [7, 11],
        [11, 6],
        [15, 5],
        [20, 6],
        [22, 9],
        [20, 11],
        [9, 13],
      ]);
      rect(c, "#f4c38a", 11, 6, 7, 2);
      rect(c, "#945047", 16, 12, 2, 7);
      rect(c, "#e9bf7b", 8, 15, 3, 2);
      rect(c, "#e9bf7b", 21, 12, 3, 2);
      rect(c, "#243e3e", 24, 13, 7, 7);
      rect(c, "#6a8671", 25, 14, 5, 4);
      rect(c, P.cream, 28, 14, 2, 2);
      rect(c, P.ink, 29, 15, 1, 2);
      rect(c, P.ink, 29, 10, 1, 3);
      rect(c, P.gold, 28, 9, 2, 2);
    });
    texture(`enemy-hopper-${f}`, 28, 30, (c) => {
      const y = f ? -1 : 0;
      poly(c, "#3c3c57", [
        [4, 23 + y],
        [3, 16 + y],
        [6, 11 + y],
        [5, 5 + y],
        [8, 2 + y],
        [11, 4 + y],
        [12, 10 + y],
        [17, 9 + y],
        [20, 3 + y],
        [23, 4 + y],
        [24, 8 + y],
        [22, 12 + y],
        [25, 17 + y],
        [24, 24 + y],
        [19, 27 + y],
        [9, 27 + y],
      ]);
      poly(c, "#857bba", [
        [6, 23 + y],
        [5, 17 + y],
        [8, 13 + y],
        [8, 6 + y],
        [10, 6 + y],
        [11, 13 + y],
        [19, 12 + y],
        [21, 6 + y],
        [22, 6 + y],
        [20, 14 + y],
        [23, 17 + y],
        [22, 23 + y],
        [18, 25 + y],
        [10, 25 + y],
      ]);
      rect(c, "#b7a8d6", 9, 15 + y, 11, 6);
      rect(c, "#ddd2e6", 11, 16 + y, 8, 3);
      rect(c, P.ink, 10, 16 + y, 2, 3);
      rect(c, P.ink, 18, 16 + y, 2, 3);
      rect(c, P.cream, 10, 16 + y, 1, 1);
      rect(c, P.cream, 18, 16 + y, 1, 1);
      rect(c, "#b88ba6", 8, 20 + y, 3, 2);
      rect(c, "#b88ba6", 20, 20 + y, 2, 2);
      rect(c, "#544f7a", 3, 25 + y, 7, 3);
      rect(c, "#544f7a", 19, 25 + y, 7, 3);
      rect(c, "#c9ba90", 4, 26 + y, 5, 1);
      rect(c, "#c9ba90", 20, 26 + y, 5, 1);
    });
    texture(`enemy-flyer-${f}`, 32, 26, (c) => {
      const y = f ? 5 : 0;
      poly(c, "#557e90", [
        [14, 15],
        [5, 13 - y],
        [1, 8 - y],
        [2, 5 - y],
        [8, 7 - y],
        [14, 11],
      ]);
      poly(c, "#c7f0df", [
        [12, 13],
        [5, 11 - y],
        [3, 7 - y],
        [7, 8 - y],
        [12, 11],
      ]);
      poly(c, "#557e90", [
        [18, 15],
        [26, 13 - y],
        [31, 8 - y],
        [30, 5 - y],
        [24, 7 - y],
        [18, 11],
      ]);
      poly(c, "#c7f0df", [
        [20, 13],
        [26, 11 - y],
        [29, 7 - y],
        [25, 8 - y],
        [20, 11],
      ]);
      rect(c, "#2c4f57", 12, 10, 8, 11);
      rect(c, "#599d9b", 13, 11, 6, 8);
      rect(c, "#d5c886", 14, 16, 4, 6);
      rect(c, "#f2e8ac", 15, 16, 2, 4);
      rect(c, P.ink, 13, 10, 2, 3);
      rect(c, P.ink, 18, 10, 2, 3);
      rect(c, P.cream, 13, 10, 1, 1);
      rect(c, P.cream, 18, 10, 1, 1);
      rect(c, "#2c4f57", 14, 7, 1, 3);
      rect(c, "#2c4f57", 18, 7, 1, 3);
      rect(c, "#f2df8d", 13, 6, 2, 2);
      rect(c, "#f2df8d", 18, 6, 2, 2);
      rect(c, "#2c4f57", 15, 23, 2, 2);
    });
  }
  texture("coin", 16, 20, (c) => {
    poly(c, "#9d6a37", [
      [5, 0],
      [11, 0],
      [15, 4],
      [15, 15],
      [11, 19],
      [5, 19],
      [1, 15],
      [1, 4],
    ]);
    poly(c, "#f4c769", [
      [5, 1],
      [10, 1],
      [14, 5],
      [14, 14],
      [10, 18],
      [5, 18],
      [2, 14],
      [2, 5],
    ]);
    rect(c, "#fff0ad", 5, 2, 5, 2);
    rect(c, "#ffe79c", 3, 5, 2, 9);
    rect(c, "#d79441", 11, 5, 2, 10);
    rect(c, "#bd823d", 7, 5, 3, 10);
    rect(c, "#fff0ad", 6, 5, 2, 9);
    rect(c, "#f9dc86", 5, 15, 6, 1);
  });
  texture("block", 32, 32, (c) => {
    rect(c, "#775e43", 0, 0, 32, 32);
    rect(c, "#deb562", 1, 1, 30, 29);
    rect(c, "#fae3a0", 2, 2, 28, 3);
    rect(c, "#b17d42", 2, 27, 28, 3);
    rect(c, "#ebca7d", 4, 6, 24, 20);
    rect(c, "#a47d49", 6, 7, 20, 18);
    rect(c, "#e8c879", 7, 8, 18, 16);
    poly(c, "#fff3be", [
      [15, 9],
      [18, 12],
      [22, 14],
      [18, 17],
      [16, 22],
      [13, 18],
      [10, 15],
      [13, 13],
    ]);
    rect(c, "#ad7a43", 15, 13, 2, 6);
    rect(c, "#fff7d5", 15, 10, 2, 3);
    for (const x of [3, 27])
      for (const y of [7, 24]) rect(c, "#8a683d", x, y, 2, 2);
  });
  texture("power-block", 32, 32, (c) => {
    c.drawImage(
      scene.textures.get("block").getSourceImage() as HTMLCanvasElement,
      0,
      0,
    );
    rect(c, "#4c7859", 7, 8, 18, 16);
    poly(c, "#bce39c", [
      [10, 20],
      [10, 15],
      [13, 11],
      [22, 10],
      [21, 16],
      [17, 21],
      [12, 22],
    ]);
    rect(c, "#f3f0c3", 14, 12, 5, 2);
    rect(c, "#5d9468", 12, 18, 3, 2);
    rect(c, "#5d9468", 15, 15, 3, 2);
  });
  texture("used-block", 32, 32, (c) => {
    rect(c, "#596e61", 0, 0, 32, 32);
    rect(c, "#8d9d7e", 1, 1, 30, 29);
    rect(c, "#b2bea0", 2, 2, 28, 2);
    rect(c, "#71826a", 2, 27, 28, 3);
    rect(c, "#71826a", 11, 11, 10, 10);
    rect(c, "#a9b495", 13, 13, 6, 6);
  });
  texture("brick", 32, 32, (c) => {
    rect(c, "#735d50", 0, 0, 32, 32);
    for (let row = 0; row < 3; row++)
      for (let col = -1; col < 3; col++) {
        const x = col * 17 + (row % 2) * 8,
          y = row * 11;
        rect(c, "#bca07a", x + 1, y + 1, 15, 9);
        rect(c, "#dfc397", x + 2, y + 1, 14, 2);
        rect(c, "#997c61", x + 2, y + 8, 14, 2);
        rect(c, "#cdb48a", x + 3, y + 4, 3, 2);
      }
    rect(c, "#73916c", 1, 1, 7, 2);
    rect(c, "#9cb378", 1, 1, 3, 1);
  });
  texture("power", 24, 24, (c) => {
    poly(c, "#2f6254", [
      [3, 17],
      [3, 9],
      [7, 4],
      [14, 2],
      [22, 2],
      [21, 10],
      [18, 17],
      [10, 21],
      [5, 20],
    ]);
    poly(c, "#94d49a", [
      [5, 16],
      [5, 10],
      [9, 6],
      [15, 4],
      [20, 4],
      [18, 11],
      [15, 16],
      [9, 19],
    ]);
    poly(c, "#d9f0b0", [
      [6, 14],
      [8, 9],
      [12, 6],
      [18, 5],
      [15, 9],
      [9, 15],
    ]);
    rect(c, "#407e69", 8, 15, 3, 3);
    rect(c, "#407e69", 11, 12, 3, 3);
    rect(c, "#407e69", 14, 9, 3, 3);
    rect(c, "#407e69", 4, 19, 4, 3);
    rect(c, "#fff5c5", 1, 3, 3, 1);
    rect(c, "#fff5c5", 2, 2, 1, 3);
    rect(c, "#fff5c5", 20, 19, 3, 1);
    rect(c, "#fff5c5", 21, 18, 1, 3);
  });
  texture("chest", 32, 28, (c) => {
    rect(c, "#3d4940", 2, 10, 28, 17);
    rect(c, "#3d4940", 5, 5, 22, 5);
    rect(c, "#9b6f4b", 4, 11, 24, 14);
    rect(c, "#bc9161", 6, 6, 20, 5);
    rect(c, "#d8b075", 6, 6, 20, 2);
    rect(c, "#6c5141", 4, 16, 24, 2);
    for (const x of [6, 23]) {
      rect(c, "#e1c17c", x, 7, 3, 17);
      rect(c, "#f4dfa0", x, 8, 1, 15);
    }
    rect(c, "#4a5042", 13, 14, 7, 7);
    rect(c, "#e6c679", 14, 14, 5, 6);
    rect(c, "#705d3c", 16, 16, 1, 3);
    rect(c, "#bd9160", 10, 21, 3, 1);
    rect(c, "#bd9160", 18, 23, 3, 1);
  });
  texture("chest-open", 32, 28, (c) => {
    c.drawImage(
      scene.textures.get("chest").getSourceImage() as HTMLCanvasElement,
      0,
      0,
    );
    c.clearRect(0, 0, 32, 14);
    poly(c, "#3d4940", [
      [3, 12],
      [5, 3],
      [27, 3],
      [29, 12],
      [27, 15],
      [5, 15],
    ]);
    rect(c, "#b68b5e", 6, 4, 20, 7);
    rect(c, "#e8c783", 7, 4, 18, 2);
    rect(c, "#483e36", 5, 12, 23, 5);
    rect(c, "#f6df96", 8, 13, 5, 2);
    rect(c, "#fff0b2", 17, 13, 6, 2);
    rect(c, "#e1c17c", 6, 6, 3, 7);
    rect(c, "#e1c17c", 23, 6, 3, 7);
  });
  texture("checkpoint", 32, 64, (c) => {
    rect(c, "#344c45", 13, 14, 6, 47);
    rect(c, "#9b8060", 14, 14, 3, 45);
    rect(c, "#c4a776", 14, 15, 1, 43);
    rect(c, "#40554a", 8, 60, 16, 4);
    rect(c, "#819478", 9, 60, 14, 2);
    rect(c, "#426858", 15, 17, 15, 12);
    rect(c, "#86bb83", 17, 18, 11, 8);
    rect(c, "#d7e7a6", 18, 19, 3, 6);
    rect(c, "#334b43", 8, 6, 16, 17);
    rect(c, "#a3ae79", 9, 7, 14, 14);
    rect(c, "#f2d890", 11, 9, 10, 11);
    rect(c, "#fff3bf", 13, 10, 6, 8);
    rect(c, "#d7b568", 15, 8, 2, 13);
    rect(c, "#78916d", 8, 6, 16, 2);
    poly(c, "#344c45", [
      [6, 6],
      [11, 2],
      [21, 2],
      [26, 6],
    ]);
    rect(c, "#9ab385", 11, 3, 10, 2);
    rect(c, "#d5c187", 15, 0, 2, 3);
  });
  texture("goal", 64, 100, (c) => {
    // Ancient lantern gateway, with a clear center silhouette.
    rect(c, "#355f58", 4, 20, 12, 76);
    rect(c, "#355f58", 48, 20, 12, 76);
    rect(c, "#c3c7a0", 6, 23, 9, 72);
    rect(c, "#c3c7a0", 49, 23, 9, 72);
    rect(c, "#e3dfba", 7, 24, 3, 70);
    rect(c, "#e3dfba", 50, 24, 3, 70);
    rect(c, "#8fa68b", 12, 24, 3, 70);
    rect(c, "#8fa68b", 55, 24, 3, 70);
    for (let y = 31; y < 91; y += 16) {
      rect(c, "#719382", 6, y, 9, 2);
      rect(c, "#719382", 49, y, 9, 2);
    }
    poly(c, "#355f58", [
      [2, 26],
      [5, 15],
      [13, 7],
      [24, 2],
      [40, 2],
      [51, 7],
      [59, 15],
      [62, 26],
      [47, 26],
      [44, 18],
      [38, 14],
      [26, 14],
      [20, 18],
      [17, 26],
    ]);
    poly(c, "#c8cda4", [
      [5, 23],
      [8, 16],
      [15, 10],
      [25, 5],
      [39, 5],
      [49, 10],
      [56, 17],
      [59, 23],
      [50, 23],
      [46, 16],
      [39, 11],
      [25, 11],
      [18, 16],
      [14, 23],
    ]);
    rect(c, "#e9e4bc", 25, 5, 14, 3);
    rect(c, "#e9e4bc", 15, 10, 7, 3);
    rect(c, "#e9e4bc", 43, 10, 6, 3);
    rect(c, "#527d66", 24, 0, 16, 17);
    rect(c, "#d6c77d", 27, 2, 10, 12);
    rect(c, "#fff2b8", 30, 4, 4, 8);
    rect(c, "#334f48", 0, 94, 64, 6);
    rect(c, "#b6c49c", 1, 94, 62, 3);
    rect(c, "#dbe0b4", 3, 94, 58, 1);
    for (const [x, y] of [
      [7, 31],
      [48, 59],
      [8, 80],
    ]) {
      rect(c, "#5c946b", x, y, 9, 3);
      rect(c, "#93b780", x + 1, y, 4, 1);
    }
    // Floating suspended orb and a gold chain.
    rect(c, "#baaa6e", 31, 17, 2, 17);
    poly(c, "#548c79", [
      [25, 37],
      [28, 33],
      [36, 33],
      [39, 37],
      [39, 44],
      [35, 48],
      [29, 48],
      [25, 44],
    ]);
    rect(c, "#bce4af", 28, 36, 8, 8);
    rect(c, "#fff3c0", 30, 37, 4, 5);
  });
  const ground = (key: string, colors: string[]) =>
    texture(key, 32, 32, (c) => {
      rect(c, colors[0], 0, 0, 32, 32);
      rect(c, colors[1], 0, 0, 32, 5);
      rect(c, colors[2], 0, 0, 32, 2);
      for (let x = 0; x < 32; x += 5) {
        rect(c, colors[1], x, 4, 3, 3 + (x % 3));
        rect(c, colors[2], x + 1, 1, 2, 1);
      }
      const stones = [
        [3, 13, 5, 3],
        [19, 9, 6, 4],
        [11, 25, 6, 3],
        [25, 23, 4, 4],
        [1, 29, 4, 2],
      ];
      for (const [x, y, w, h] of stones) {
        rect(c, colors[3], x, y, w, h);
        rect(c, colors[4], x, y, w - 1, 1);
      }
      rect(c, colors[5], 9, 9, 2, 1);
      rect(c, colors[5], 23, 18, 2, 2);
      rect(c, colors[5], 6, 22, 1, 2);
    });
  ground("tile-grass", [
    "#927354",
    "#69945c",
    "#b7cf80",
    "#775f4d",
    "#b3986b",
    "#c7b17d",
  ]);
  ground("tile-cave", [
    "#384d59",
    "#617e80",
    "#a0b2a0",
    "#2c3d4b",
    "#4e6872",
    "#769799",
  ]);
  ground("tile-sky", [
    "#9f9e87",
    "#92b09a",
    "#d6dec0",
    "#7d8f83",
    "#c3c3a6",
    "#d8d4ae",
  ]);
  for (const [theme, colors] of Object.entries({
    grass: ["#896d53", "#735d4d", "#a58a65", "#b89e72"],
    cave: ["#334956", "#273a48", "#48616a", "#5a7880"],
    sky: ["#959783", "#76897d", "#b0b39b", "#c2c4a7"],
  }))
    texture(`terrain-${theme}`, 64, 64, (c) => {
      rect(c, colors[0], 0, 0, 64, 64);
      for (const [x, y, w, h] of [
        [6, 8, 9, 6],
        [33, 3, 6, 4],
        [49, 19, 10, 7],
        [23, 31, 11, 6],
        [5, 47, 6, 5],
        [45, 51, 8, 6],
        [17, 61, 5, 3],
      ]) {
        rect(c, colors[1], x, y, w, h);
        rect(c, colors[2], x, y, w - 1, 2);
        rect(c, colors[2], x + 1, y + 2, 2, Math.max(1, h - 3));
      }
      for (const [x, y] of [
        [22, 15],
        [41, 28],
        [13, 32],
        [34, 50],
        [57, 43],
        [2, 26],
      ]) {
        rect(c, colors[3], x, y, 2, 1);
      }
      rect(c, colors[1], 19, 18, 1, 10);
      rect(c, colors[1], 20, 27, 4, 1);
      rect(c, colors[1], 51, 36, 7, 1);
    });
  texture("platform", 64, 16, (c) => {
    rect(c, "#3e6258", 0, 3, 64, 10);
    rect(c, "#8eb18a", 0, 1, 64, 6);
    rect(c, "#d6dda4", 2, 1, 60, 2);
    rect(c, "#b8ca98", 2, 4, 60, 2);
    for (let x = 5; x < 60; x += 13) {
      rect(c, "#718675", x, 7, 9, 6);
      rect(c, "#aec09a", x + 1, 7, 6, 2);
    }
    rect(c, "#4b6b60", 4, 13, 56, 2);
  });
  texture("spark", 5, 5, (c) => {
    rect(c, P.cream, 2, 0, 1, 5);
    rect(c, P.cream, 0, 2, 5, 1);
    rect(c, "#fffbea", 1, 1, 3, 3);
  });
  texture("dust", 4, 4, (c) => {
    rect(c, "#ede5bd", 1, 0, 2, 4);
    rect(c, "#ede5bd", 0, 1, 4, 2);
  });
  texture("leaf-particle", 6, 4, (c) => {
    rect(c, "#b8d49b", 1, 0, 4, 3);
    rect(c, "#76a777", 0, 2, 4, 2);
  });
  texture("flower", 12, 16, (c) => {
    rect(c, "#406e50", 5, 6, 2, 10);
    rect(c, "#79a767", 2, 10, 4, 2);
    rect(c, "#79a767", 7, 12, 3, 2);
    rect(c, "#f0be98", 3, 1, 6, 7);
    rect(c, "#f0be98", 1, 3, 10, 3);
    rect(c, "#fff0c3", 4, 3, 4, 3);
  });
}
