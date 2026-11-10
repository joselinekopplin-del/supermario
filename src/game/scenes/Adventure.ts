import Phaser from "phaser";
import { generateTextures } from "../art/textures";
import { drawBackground } from "../art/background";
import { drawMenuVignette } from "../art/preview";
import { drawHazards, drawWorldAccents } from "../art/environment";
import { ambientTween, applyWorldPreferences } from "../art/preferences";
import { levels } from "../levels";
import type { Level } from "../levels";
import { PHYSICS as P } from "../config";
import {
  bodyAt,
  stepBody,
  overlaps,
  type Body,
  type Solid,
} from "../physics/motion";
import { Controls } from "../systems/input";
import { Enemy } from "../entities/Enemy";
import { PowerItem } from "../entities/PowerItem";
import { burst } from "../effects/particles";
import { PlayerFeedback, FEEDBACK } from "../effects/playerFeedback";
import { cameraAt, followCamera, type CameraState } from "../systems/camera";
import { audio } from "../audio/audio";
import { saveStore } from "../systems/save";
import type { GameUI } from "../../ui/GameUI";

type Coin = {
  x: number;
  y: number;
  hidden?: boolean;
  sprite: Phaser.GameObjects.Image;
  taken: boolean;
};
type Block = Solid & {
  kind: "reward" | "brick" | "power";
  sprite: Phaser.GameObjects.Image;
  used: boolean;
};
type Moving = Solid & {
  baseX: number;
  baseY: number;
  axis: "x" | "y";
  distance: number;
  duration: number;
  sprite: Phaser.GameObjects.TileSprite;
};
export class Adventure extends Phaser.Scene {
  ui!: GameUI;
  level!: Level;
  player!: Phaser.GameObjects.Sprite;
  body!: Body;
  controls!: Controls;
  solids: Solid[] = [];
  moving: Moving[] = [];
  blocks: Block[] = [];
  coins: Coin[] = [];
  enemies: Enemy[] = [];
  health = 3;
  score = 0;
  coinCount = 0;
  elapsed = 0;
  accumulator = 0;
  invincible = 0;
  powered = 0;
  checkpoint = false;
  mode: "menu" | "playing" | "paused" | "dead" | "complete" = "menu";
  checkSprite!: Phaser.GameObjects.Image;
  chests: {
    x: number;
    y: number;
    opened: boolean;
    sprite: Phaser.GameObjects.Image;
  }[] = [];
  powerItems: PowerItem[] = [];
  landTimer = 0;
  lastHUD = 0;
  decorClock = 0;
  feedback = new PlayerFeedback();
  cameraState: CameraState = cameraAt();
  deathTimer?: Phaser.Time.TimerEvent;
  failureReason: "pit" | "enemy" | "hazard" = "enemy";
  onReady?: () => void;
  constructor() {
    super("adventure");
  }
  create() {
    generateTextures(this);
    this.controls = new Controls(this);
    this.loadLevel(1, true);
    this.onReady?.();
    // Phaser may revisit its queue before the next render when several native
    // events arrive together. Menu commands must consume each event only once.
    const handledCommands = new WeakSet<KeyboardEvent>();
    const consumeCommand = (event: KeyboardEvent) => {
      if (event.repeat || handledCommands.has(event)) return false;
      handledCommands.add(event);
      return true;
    };
    this.input.keyboard!.on("keydown-ESC", (event: KeyboardEvent) => {
      if (!consumeCommand(event)) return;
      if (this.mode === "playing") this.pauseGame();
      else if (this.mode === "paused") this.resumeGame();
    });
    this.input.keyboard!.on("keydown-R", (event: KeyboardEvent) => {
      if (!consumeCommand(event)) return;
      if (this.mode !== "menu") this.loadLevel(this.level.id);
    });
    const blur = () => {
      if (this.mode === "playing") this.pauseGame();
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    const settingsChanged = () => {
      const settings = saveStore.data.settings;
      applyWorldPreferences(this, {
        reducedMotion: settings.reducedMotion,
        effectsQuality: settings.effects,
      });
      if (this.mode === "paused") this.tweens.pauseAll();
      if (settings.reducedMotion || !settings.screenShake)
        this.cameras.main.shakeEffect.reset();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("mosslight-settings", settingsChanged);
    document.addEventListener("visibilitychange", visibility);
    const cleanup = () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("mosslight-settings", settingsChanged);
      document.removeEventListener("visibilitychange", visibility);
    };
    this.events.once("shutdown", cleanup);
    this.events.once("destroy", cleanup);
  }
  loadLevel(id: number, preview = false) {
    audio.stopAll();
    this.tweens.resumeAll();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.time.clearPendingEvents();
    // DisplayList.removeAll only detaches objects; destroy releases text/tile GPU textures too.
    this.children.list.slice().forEach((child) => child.destroy());
    this.level = levels[id - 1];
    this.solids = [];
    this.moving = [];
    this.blocks = [];
    this.coins = [];
    this.enemies = [];
    this.chests = [];
    this.powerItems = [];
    this.health = 3;
    this.score = 0;
    this.coinCount = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.invincible = 0;
    this.powered = 0;
    this.checkpoint = false;
    this.landTimer = 0;
    this.feedback = new PlayerFeedback();
    this.deathTimer = undefined;
    this.lastHUD = 0;
    this.mode = preview ? "menu" : "playing";
    this.controls.reset();
    this.controls.setGameplayCapture(!preview);
    const artOptions = {
      reducedMotion: saveStore.data.settings.reducedMotion,
      effectsQuality: saveStore.data.settings.effects,
    };
    drawBackground(this, this.level.theme, this.level.width, artOptions);
    if (!preview) drawWorldAccents(this, this.level, artOptions);
    const tile = `tile-${this.level.theme === "meadow" ? "grass" : this.level.theme}`;
    this.level.platforms.forEach((p, i) => {
      const solid: Solid = { ...p, id: i };
      this.solids.push(solid);
      // Surface and earth have separate textures so grass never repeats underground.
      if (!p.move && p.h > 32) {
        this.add
          .tileSprite(
            p.x,
            p.y + 24,
            p.w,
            p.h - 24,
            `terrain-${this.level.theme === "meadow" ? "grass" : this.level.theme}`,
          )
          .setOrigin(0)
          .setDepth(3);
        this.add
          .rectangle(p.x, p.y + 31, p.w, 5, 0x162d2b, 0.13)
          .setOrigin(0)
          .setDepth(3.1);
        this.add
          .rectangle(p.x, p.y + 31, 3, p.h - 31, 0xd6d8ad, 0.12)
          .setOrigin(0)
          .setDepth(3.1);
        this.add
          .rectangle(p.x + p.w - 4, p.y + 31, 4, p.h - 31, 0x192d2d, 0.2)
          .setOrigin(0)
          .setDepth(3.1);
      }
      const sprite = this.add
        .tileSprite(
          p.x,
          p.y,
          p.w,
          p.move ? p.h : Math.min(p.h, 32),
          p.move ? "platform" : tile,
        )
        .setOrigin(0)
        .setDepth(3.2);
      if (p.move) {
        const moving = Object.assign(solid, {
          baseX: p.x,
          baseY: p.y,
          axis: p.move.axis,
          distance: p.move.distance,
          duration: p.move.duration,
          sprite,
        });
        this.moving.push(moving);
      } else {
        if (p.h <= 32)
          this.add
            .rectangle(p.x + 3, p.y + p.h - 3, p.w - 6, 3, 0x2d5145, 0.35)
            .setOrigin(0)
            .setDepth(3.4);
        if (this.level.theme === "meadow")
          for (let x = p.x + 43; x < p.x + p.w - 20; x += 113) {
            const detail = this.add.graphics().setDepth(3.5);
            detail.fillStyle(0x74985b);
            detail.fillRect(x, p.y - 4, 2, 4);
            detail.fillRect(x + 4, p.y - 7, 2, 7);
            detail.fillRect(x + 8, p.y - 3, 2, 3);
            if (Math.floor(x / 113) % 3 === 0)
              this.add
                .image(x + 17, p.y, "flower")
                .setOrigin(0.5, 1)
                .setDepth(3.5);
          }
      }
    });
    this.level.blocks.forEach((b, i) => {
      const block: Block = {
        x: b.x - 16,
        y: b.y - 16,
        w: 32,
        h: 32,
        id: 1000 + i,
        kind: b.kind,
        sprite: this.add
          .image(
            b.x,
            b.y,
            b.kind === "brick"
              ? "brick"
              : b.kind === "power"
                ? "power-block"
                : "block",
          )
          .setDepth(5),
        used: false,
      };
      this.blocks.push(block);
      this.solids.push(block);
    });
    this.coins = this.level.coins.map((c) => ({
      ...c,
      taken: false,
      sprite: this.add
        .image(c.x, c.y, "coin")
        .setDepth(5)
        .setAlpha(c.hidden ? 0.35 : 1),
    }));
    this.enemies = this.level.enemies.map((e) => new Enemy(this, e));
    drawHazards(this, this.level.hazards, this.level.theme);
    this.checkSprite = this.add
      .image(this.level.checkpoint.x, this.level.checkpoint.y, "checkpoint")
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setTint(0xa4bbb1);
    const goal = this.add
      .image(this.level.goal.x, this.level.goal.y, "goal")
      .setOrigin(0.5, 1)
      .setDepth(4);
    ambientTween(this, {
      targets: goal,
      alpha: 0.8,
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });
    this.add
      .text(this.level.goal.x, this.level.goal.y - 116, "光之门", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#f7ffdf",
        backgroundColor: "#285547",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.chests = this.level.chests.map((c) => ({
      ...c,
      opened: false,
      sprite: this.add.image(c.x, c.y, "chest").setDepth(5),
    }));
    this.level.signs.forEach((s, i) => {
      const raised = i > 0 && s.x - this.level.signs[i - 1].x < 190;
      const y = s.y - 68 - (raised ? 45 : 0);
      this.add
        .rectangle(s.x - 2, y + 12, 4, s.y - y - 10, 0x66836a)
        .setOrigin(0)
        .setDepth(2);
      this.add
        .rectangle(s.x - 1, y + 14, 1, s.y - y - 12, 0xbcc59a)
        .setOrigin(0)
        .setDepth(2.1);
      const label = this.add
        .text(s.x, y, s.text, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: this.level.theme === "cave" ? "#d8e7d6" : "#355b49",
          backgroundColor: this.level.theme === "cave" ? "#233f4b" : "#eef0d5",
          padding: { x: 10, y: 6 },
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(2.5);
      this.add
        .rectangle(
          s.x - label.width / 2,
          y + label.height / 2,
          label.width,
          2,
          this.level.theme === "cave" ? 0x5f8883 : 0xaabd92,
        )
        .setOrigin(0)
        .setDepth(2.5);
    });
    this.body = bodyAt(this.level.spawn.x, this.level.spawn.y);
    this.player = this.add
      .sprite(this.body.x, this.body.y, "player-idle-0")
      .setDepth(10);
    if (preview) {
      // The menu has its own illustrated focal point, without tutorial labels.
      this.children.list.forEach((child) => {
        const item = child as Phaser.GameObjects.Image;
        if (item.depth >= 2) item.setVisible(false);
      });
      drawMenuVignette(this);
    }
    this.cameraState = cameraAt();
    this.cameras.main.stopFollow();
    this.cameras.main.setBounds(0, 0, this.level.width, 576);
    this.cameras.main.setScroll(0, 0);
    this.ui?.showHUD(!preview);
    if (!preview) {
      this.ui?.hideOverlay();
      audio.unlock();
      audio.startMusic(this.level.theme);
      const hint = matchMedia("(pointer: coarse)").matches
        ? "方向键移动 · 轻点低跳 · 按住疾跑跃得更远"
        : "A/D 移动 · 空格跳跃 · Shift 疾跑";
      this.ui?.toast(
        id === 1
          ? `阳光草原 · ${hint}`
          : `${String(id).padStart(2, "0")} / ${this.level.name}`,
      );
    } else audio.stopMusic();
    this.updateHUD();
  }
  pauseGame() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    this.controls.reset();
    this.controls.setGameplayCapture(false);
    this.tweens.pauseAll();
    audio.pauseMusic();
    this.ui.showPause();
  }
  resumeGame() {
    if (this.mode !== "paused") return;
    this.mode = "playing";
    this.controls.reset();
    this.controls.setGameplayCapture(true);
    this.tweens.resumeAll();
    applyWorldPreferences(this, {
      reducedMotion: saveStore.data.settings.reducedMotion,
      effectsQuality: saveStore.data.settings.effects,
    });
    audio.unlock();
    audio.resumeMusic(this.level.theme);
    this.ui.hideOverlay();
  }
  menu() {
    this.loadLevel(1, true);
    this.ui.showMenu();
  }
  update(_time: number, delta: number) {
    if (!this.body) return;
    this.decorClock += Math.min(delta, 50) / 1000;
    if (this.mode === "menu") {
      this.player.setTexture(
        `player-idle-${Math.floor(this.decorClock * 4) % 4}`,
      );
      return;
    }
    if (this.mode !== "playing") return;
    this.accumulator += Math.min(delta / 1000, 0.05);
    while (this.accumulator + 1e-10 >= P.step && this.mode === "playing") {
      this.simulate(P.step, this.controls.consume());
      this.accumulator = Math.max(0, this.accumulator - P.step);
    }
    if (this.mode === "playing") this.renderPlayer();
    else
      this.player.setPosition(Math.round(this.body.x), Math.round(this.body.y));
    const camera = followCamera(
      this.cameraState,
      this.body,
      Math.min(delta / 1000, 0.05),
      this.level.width,
      saveStore.data.settings.reducedMotion,
    );
    this.cameras.main.setScroll(Math.round(camera.x), Math.round(camera.y));
    this.coins.forEach((c, i) => {
      if (!c.taken && saveStore.data.settings.reducedMotion)
        c.sprite.setScale(1).setY(c.y);
      if (!c.taken && !saveStore.data.settings.reducedMotion)
        c.sprite
          .setScale(
            0.35 + Math.abs(Math.cos(this.decorClock * 3 + i * 0.4)) * 0.65,
            1,
          )
          .setY(c.y + Math.sin(this.decorClock * 3 + i) * 3);
    });
    if (this.elapsed - this.lastHUD > 0.1) {
      this.updateHUD();
      this.lastHUD = this.elapsed;
    }
  }
  simulate(dt: number, input: ReturnType<Controls["read"]>) {
    this.elapsed += dt;
    this.invincible = Math.max(0, this.invincible - dt);
    this.powered = Math.max(0, this.powered - dt);
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.feedback.tick(this.body, dt, saveStore.data.settings.reducedMotion);
    for (const m of this.moving) {
      const oldX = m.x,
        oldY = m.y;
      const period = m.duration > 100 ? m.duration / 1000 : m.duration;
      const offset =
        Math.sin((this.elapsed * Math.PI * 2) / period) * m.distance;
      m.x = m.baseX + (m.axis === "x" ? offset : 0);
      m.y = m.baseY + (m.axis === "y" ? offset : 0);
      m.dx = m.x - oldX;
      m.dy = m.y - oldY;
      m.sprite.setPosition(m.x, m.y);
    }
    const b = this.body,
      oldBottom = b.y + b.h / 2;
    stepBody(b, input, this.solids, dt, this.powered > 0);
    if (b.jumped) {
      this.landTimer = 0;
      this.feedback.jump(saveStore.data.settings.reducedMotion);
      audio.play("jump");
      burst(this, b.x, b.y + 17, 0xf0e8bd, 7, 22);
    }
    if (b.landed) {
      this.landTimer = FEEDBACK.landingDuration;
      this.feedback.land(b.landingSpeed, saveStore.data.settings.reducedMotion);
      if (b.landingSpeed > 90)
        burst(
          this,
          b.x,
          b.y + 18,
          0xd7d7ad,
          Math.ceil(3 + b.landingSpeed / 120),
          16 + b.landingSpeed / 30,
        );
    }
    if (b.grounded && Math.abs(b.vx) > 290 && this.feedback.dustTime === 0) {
      this.feedback.dustTime = FEEDBACK.dustInterval;
      burst(this, b.x - Math.sign(b.vx) * 10, b.y + 16, 0xd7d7ad, 2, 10);
    }
    if (b.hit >= 1000) this.hitBlock(b.hit);
    for (const c of this.coins)
      if (!c.taken && Math.abs(b.x - c.x) < 24 && Math.abs(b.y - c.y) < 29) {
        c.taken = true;
        c.sprite.destroy();
        this.coinCount++;
        this.score += 100;
        audio.play("coin");
        burst(this, c.x, c.y, 0xffdf7a, 7, 25);
      }
    for (const e of this.enemies) {
      e.update(dt, this.solids);
      if (!e.alive) continue;
      if (overlaps(b, e)) {
        if (b.vy > 20 && oldBottom <= e.y - e.h / 2 + 12) {
          e.stomp(this);
          b.vy = input.jump ? -430 : -340;
          b.grounded = false;
          b.support = -1;
          this.feedback.jump(saveStore.data.settings.reducedMotion);
          this.score += 250;
          audio.play("stomp");
          burst(this, e.x, e.y, 0xe6d9ac, 8, 30);
        } else if (this.powered > 0) {
          e.stomp(this);
          this.score += 250;
          audio.play("stomp");
          burst(this, e.x, e.y, 0xb9eb94, 9, 35);
        } else this.hurt(e.x, "enemy");
      }
    }
    for (const h of this.level.hazards)
      if (overlaps(b, { x: h.x + h.w / 2, y: h.y + h.h / 2, w: h.w, h: h.h }))
        this.hurt(h.x + h.w / 2, "hazard");
    for (const c of this.chests)
      if (!c.opened && Math.abs(b.x - c.x) < 30 && Math.abs(b.y - c.y) < 38) {
        c.opened = true;
        c.sprite.setTexture("chest-open");
        this.score += 1000;
        this.coinCount += 5;
        audio.play("power");
        burst(this, c.x, c.y, 0xffdd6a, 20, 65);
        this.ui.toast("发现秘密宝箱 · +1,000 分 / +5 金币");
      }
    this.powerItems = this.powerItems.filter((p) => {
      p.update(dt, this.solids);
      if (p.y > 620) {
        p.sprite.destroy();
        return false;
      }
      if (Math.abs(b.x - p.x) < 29 && Math.abs(b.y - p.y) < 35) {
        p.sprite.destroy();
        this.powered = 12;
        this.health = Math.min(3, this.health + 1);
        audio.play("power");
        burst(this, b.x, b.y, 0xc1f491, 20, 50);
        this.ui.toast("叶光守护 · 12 秒护盾与加速");
        return false;
      }
      return true;
    });
    if (
      !this.checkpoint &&
      Math.abs(b.x - this.level.checkpoint.x) < 38 &&
      Math.abs(b.y - this.level.checkpoint.y) < 80
    ) {
      this.checkpoint = true;
      this.checkSprite.clearTint();
      audio.play("checkpoint");
      burst(
        this,
        this.checkSprite.x,
        this.checkSprite.y - 40,
        0xc4f4b0,
        16,
        45,
      );
      this.ui.toast("旅途已点亮 · 检查点激活");
    }
    if (b.y > 620) this.die("pit");
    if (
      Math.abs(b.x - this.level.goal.x) < 32 &&
      Math.abs(b.y - this.level.goal.y) < 70
    )
      this.complete();
  }
  hitBlock(id: number) {
    const block = this.blocks.find((b) => b.id === id);
    if (!block || block.used) return;
    audio.play("bump");
    if (block.kind === "brick") {
      block.used = true;
      this.solids = this.solids.filter((s) => s.id !== id);
      block.sprite.destroy();
      this.score += 50;
      burst(this, block.x + 16, block.y + 16, 0xbc9475, 12, 45);
      return;
    }
    block.used = true;
    block.sprite.setTexture("used-block");
    this.tweens.add({
      targets: block.sprite,
      y: block.y + (saveStore.data.settings.reducedMotion ? 14 : 9),
      scaleX: saveStore.data.settings.reducedMotion ? 1 : 1.06,
      scaleY: saveStore.data.settings.reducedMotion ? 1 : 0.94,
      duration: 85,
      yoyo: true,
    });
    if (block.kind === "power")
      this.powerItems.push(new PowerItem(this, block.x + 16, block.y - 12));
    else {
      this.coinCount++;
      this.score += 100;
      const sprite = this.add
        .image(block.x + 16, block.y - 6, "coin")
        .setDepth(6);
      this.tweens.add({
        targets: sprite,
        y: block.y - 65,
        alpha: 0,
        duration: 450,
        onComplete: () => sprite.destroy(),
      });
      audio.play("coin");
    }
  }
  hurt(source: number, reason: "enemy" | "hazard" = "enemy") {
    if (this.invincible > 0 || this.mode !== "playing") return;
    this.health--;
    this.invincible = 1.5;
    this.body.vx = this.body.x < source ? -220 : 220;
    this.body.vy = -250;
    this.body.grounded = false;
    this.body.support = -1;
    this.feedback.hurt();
    audio.play("hurt");
    if (
      saveStore.data.settings.screenShake &&
      !saveStore.data.settings.reducedMotion
    )
      this.cameras.main.shake(100, 0.0015);
    burst(this, this.body.x, this.body.y, 0xf49d7d, 10, 35);
    this.updateHUD();
    if (this.health <= 0) this.die(reason);
  }
  die(reason: "pit" | "enemy" | "hazard" = "enemy") {
    if (this.mode !== "playing") return;
    this.mode = "dead";
    this.failureReason = reason;
    this.controls.setGameplayCapture(false);
    audio.stopMusic();
    audio.play("fail");
    this.player.setTexture("player-hurt");
    burst(this, this.body.x, Math.min(this.body.y, 500), 0xffd3a0, 20, 65);
    this.deathTimer = this.time.delayedCall(320, () => {
      if (this.mode === "dead")
        this.ui.showFailure({
          reason: this.failureReason,
          checkpoint: this.checkpoint,
        });
    });
  }
  respawn() {
    this.deathTimer?.remove();
    this.deathTimer = undefined;
    if (this.checkpoint) {
      const score = this.score,
        coins = this.coinCount,
        elapsed = this.elapsed;
      this.body = bodyAt(
        this.level.checkpoint.x + 32,
        this.level.checkpoint.y - 22,
      );
      this.health = 3;
      this.powered = 0;
      this.invincible = 2;
      this.accumulator = 0;
      this.feedback = new PlayerFeedback();
      this.landTimer = 0;
      this.player.setAlpha(1).setScale(1).clearTint();
      this.cameraState = cameraAt(
        Math.max(0, Math.min(this.level.width - 960, this.body.x - 360)),
      );
      this.cameras.main.setScroll(this.cameraState.x, 0);
      this.renderPlayer();
      this.mode = "playing";
      this.controls.reset();
      this.controls.setGameplayCapture(true);
      this.score = score;
      this.coinCount = coins;
      this.elapsed = elapsed;
      this.ui.hideOverlay();
      audio.startMusic(this.level.theme);
      this.updateHUD();
    } else this.loadLevel(this.level.id);
  }
  complete() {
    if (this.mode !== "playing") return;
    this.mode = "complete";
    this.controls.setGameplayCapture(false);
    this.score +=
      Math.max(0, Math.round(180 - this.elapsed)) * 10 + this.health * 200;
    this.updateHUD();
    saveStore.complete(
      this.level.id,
      this.score,
      this.coinCount,
      Math.round(this.elapsed),
    );
    audio.stopMusic();
    audio.play("win");
    this.player
      .setTexture("player-celebrate-0")
      .setAlpha(1)
      .setScale(1)
      .clearTint();
    this.time.addEvent({
      delay: 120,
      repeat: 7,
      callback: () => {
        this.player.setTexture(
          `player-celebrate-${Math.floor(Math.random() * 4)}`,
        );
        burst(
          this,
          this.body.x + Phaser.Math.Between(-70, 70),
          this.body.y - 80,
          Phaser.Math.RND.pick([0xffd875, 0xa9e8bc, 0xf3afae]),
          12,
          75,
        );
      },
    });
    this.time.delayedCall(1100, () => {
      if (this.mode !== "complete") return;
      this.ui.showComplete({
        level: this.level.id,
        score: this.score,
        coins: this.coinCount,
        time: Math.round(this.elapsed),
      });
    });
  }
  renderPlayer() {
    const b = this.body;
    const reduced = saveStore.data.settings.reducedMotion;
    this.player
      .setPosition(
        Math.round(b.x),
        Math.round(b.y + (1 - this.feedback.scaleY) * 17),
      )
      .setScale(this.feedback.scaleX, this.feedback.scaleY);
    if (Math.abs(b.vx) > 5) this.player.setFlipX(b.vx < 0);
    const texture = this.feedback.texture(b, this.elapsed, this.landTimer);
    this.player
      .setTexture(texture)
      .setAlpha(
        this.invincible > 0 &&
          (reduced || Math.floor(this.elapsed * 6) % 2 === 0)
          ? 0.75
          : 1,
      );
    if (this.powered > 0) this.player.setTint(0xd9ffb4);
    else this.player.clearTint();
  }
  updateHUD() {
    this.ui?.updateHUD({
      level: this.level.id,
      health: this.health,
      coins: this.coinCount,
      score: this.score,
      time: Math.floor(this.elapsed),
      powered: this.powered > 0,
      powerSeconds: Math.ceil(this.powered),
      checkpoint: this.checkpoint,
      progress: Math.max(0, Math.min(1, this.body.x / this.level.goal.x)),
      invincible: this.invincible > 0,
    });
  }
  snapshot() {
    return {
      mode: this.mode,
      level: this.level.id,
      x: this.body.x,
      y: this.body.y,
      vx: this.body.vx,
      vy: this.body.vy,
      grounded: this.body.grounded,
      health: this.health,
      coins: this.coinCount,
      score: this.score,
      time: this.elapsed,
      checkpoint: this.checkpoint,
      powered: this.powered,
      enemies: this.enemies.filter((e) => e.alive).length,
    };
  }
}
