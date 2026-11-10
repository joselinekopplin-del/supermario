import Phaser from "phaser";
import { Adventure } from "./game/scenes/Adventure";
import { GameUI } from "./ui/GameUI";
import { VIEW } from "./game/config";
import { saveStore } from "./game/systems/save";
import { audio } from "./game/audio/audio";
import "./ui/style.css";

const scene = new Adventure();
const ui = new GameUI({
  start(level) {
    audio.unlock();
    scene.loadLevel(Math.max(1, Math.min(level, saveStore.data.unlocked)));
  },
  resume() {
    scene.resumeGame();
  },
  restart() {
    if (scene.mode === "dead") scene.respawn();
    else scene.loadLevel(scene.level.id);
  },
  menu() {
    scene.menu();
  },
  pause() {
    scene.pauseGame();
  },
});
scene.ui = ui;
scene.onReady = () => ui.showMenu();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: "#95c9ca",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: false, powerPreference: "high-performance" },
  // Native refresh keeps 60 Hz displays smooth; fixed-step physics stays stable
  // on faster displays too. Phaser's hard limiter can halve a 59.94 Hz refresh.
  fps: { target: 60, smoothStep: false },
  scene: [scene],
  audio: { noAudio: true },
});
// Development-only instrumentation: not present in production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test")) {
  Object.assign(window, {
    __game: { scene, game, saveStore, snapshot: () => scene.snapshot() },
  });
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    ui.destroy();
    audio.stopAll();
    game.destroy(true);
  });
