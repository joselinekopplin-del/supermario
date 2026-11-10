import { saveStore } from "../game/systems/save";
import { audio } from "../game/audio/audio";

export const touchState = {
  left: false,
  right: false,
  jump: false,
  run: false,
  jumpPressed: false,
  jumpReleased: false,
};
interface Callbacks {
  start(level: number): void;
  resume(): void;
  restart(): void;
  menu(): void;
  pause(): void;
}
interface HUD {
  level: number;
  health: number;
  coins: number;
  score: number;
  time: number;
  powered: boolean;
  powerSeconds?: number;
  checkpoint?: boolean;
  progress?: number;
  invincible?: boolean;
}
interface Result {
  level: number;
  score: number;
  coins: number;
  time: number;
}
const names = ["阳光草原", "地下洞穴", "天空城堡"];
const icons = ["✿", "◈", "✧"];
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const svg = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const leaf = svg(
  '<path d="M5 20C-1 5 13 2 21 3c1 12-5 19-16 17Z"/><path d="m5 20 10-10"/>',
);
const arrow = svg('<path d="M5 12h14m-6-6 6 6-6 6"/>');
const gear = svg(
  '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2 3 3-1 3 1 2-3 3-2-1-3 2-2-2-3-3-1-1-3Z"/>',
);

export class GameUI {
  private root: HTMLElement;
  private overlay: HTMLDivElement;
  private hud: HTMLDivElement;
  private toastNode: HTMLDivElement;
  private controls: HTMLDivElement;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private playing = false;
  private cachedHUD = "";
  private lastHUD?: HUD;
  private renderVersion = 0;
  private touchPointers = new Map<keyof typeof touchState, Set<number>>();
  private focusReturnAction?: string;
  private callbacks: Callbacks;
  private onBlur = () => this.resetTouch();
  private onVisibility = () => {
    if (document.hidden) this.resetTouch();
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.isOpen) return;
    if (
      event.code === "Escape" &&
      this.overlay.classList.contains("overlay-center")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) this.action("back");
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      this.overlay.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input,select,[tabindex='0']",
      ),
    );
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) return;
    if (
      !this.overlay.contains(document.activeElement) ||
      (event.shiftKey && document.activeElement === first)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  get isOpen() {
    return !this.overlay.hidden;
  }
  constructor(callbacks: Callbacks) {
    this.callbacks = callbacks;
    this.root = document.getElementById("ui-root")!;
    this.root.innerHTML = `<div class="game-hud" hidden><div class="hud-chapter"><span class="hud-level-number">01</span><div><small>正在探索</small><strong id="hud-level">阳光草原</strong></div></div><div class="hud-counters"><span id="hud-health" class="hud-hearts" aria-label="生命值">♥ ♥ ♥</span><span class="hud-coin"><i>◆</i><b id="hud-coins">00</b></span><span class="hud-score"><small>得分</small><b id="hud-score">00000</b></span><span class="hud-time"><small>时间</small><b id="hud-time">00:00</b></span><button class="hud-pause" title="暂停 · Esc" aria-label="暂停游戏">Ⅱ</button></div><div id="hud-power" class="power-pill" hidden>✦ 叶光护佑 · 强化中</div></div><div class="game-overlay" hidden></div><div class="game-toast" role="status" aria-live="polite"></div><div class="touch-controls" hidden><div class="touch-directions"><button data-touch="left" aria-label="向左移动">‹</button><button data-touch="right" aria-label="向右移动">›</button></div><div class="touch-actions"><button data-touch="run" class="touch-run" aria-label="加速奔跑">疾跑</button><button data-touch="jump" class="touch-jump" aria-label="跳跃">↑<span>跳跃</span></button></div></div>`;
    this.overlay = this.root.querySelector(".game-overlay")!;
    this.hud = this.root.querySelector(".game-hud")!;
    this.toastNode = this.root.querySelector(".game-toast")!;
    this.controls = this.root.querySelector(".touch-controls")!;
    this.overlay.setAttribute("tabindex", "-1");
    const journey = document.createElement("div");
    journey.className = "hud-journey";
    journey.innerHTML =
      '<span id="hud-checkpoint">◇ 前往苔光灯</span><span class="journey-track"><i id="hud-progress"></i></span>';
    this.hud.querySelector(".hud-chapter")!.append(journey);
    const portraitGuide = document.createElement("div");
    portraitGuide.className = "portrait-guide";
    portraitGuide.innerHTML =
      '<span class="portrait-guide-leaf">✦</span><strong>把勇气，握在手里。</strong><p>轻点低跳，长按高跳。<br>同时按住疾跑，跃得更远。</p><small>横转设备，可获得更开阔的冒险视野</small>';
    this.root.append(portraitGuide);
    this.root
      .querySelector(".hud-pause")!
      .addEventListener("click", () => callbacks.pause());
    this.controls
      .querySelectorAll<HTMLButtonElement>("[data-touch]")
      .forEach((button) => {
        const key = button.dataset.touch as keyof typeof touchState;
        const pointers = new Set<number>();
        this.touchPointers.set(key, pointers);
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          // A pointer may already have been cancelled by the browser's gesture handling.
          try {
            button.setPointerCapture(event.pointerId);
          } catch {
            /* Release/reset still clears held input. */
          }
          if (key === "jump" && !touchState.jump) touchState.jumpPressed = true;
          pointers.add(event.pointerId);
          touchState[key] = true;
          button.classList.add("held");
        });
        const release = (event: PointerEvent) => {
          pointers.delete(event.pointerId);
          if (pointers.size) return;
          if (key === "jump" && touchState.jump) touchState.jumpReleased = true;
          touchState[key] = false;
          button.classList.remove("held");
        };
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
      });
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("keydown", this.onKeyDown, true);
    audio.setVolumes(
      saveStore.data.settings.music,
      saveStore.data.settings.sfx,
    );
    this.applyVisualSettings();
  }
  private resetTouch() {
    this.touchPointers.forEach((pointers) => pointers.clear());
    Object.keys(touchState).forEach((key) => {
      touchState[key as keyof typeof touchState] = false;
    });
    this.controls
      .querySelectorAll(".held")
      .forEach((b) => b.classList.remove("held"));
  }
  private render(html: string, mode = "center") {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastNode.classList.remove("show");
    this.resetTouch();
    this.overlay.hidden = false;
    this.overlay.className = `game-overlay overlay-${mode}`;
    this.overlay.innerHTML = html;
    this.hud.inert = true;
    this.overlay.setAttribute("role", mode === "menu" ? "region" : "dialog");
    if (mode === "menu") this.overlay.removeAttribute("aria-modal");
    else this.overlay.setAttribute("aria-modal", "true");
    const heading = this.overlay.querySelector("h1,h2");
    if (heading) {
      heading.id = "game-dialog-title";
      this.overlay.setAttribute("aria-labelledby", heading.id);
    }
    this.controls.hidden = true;
    this.overlay
      .querySelectorAll<HTMLButtonElement>("button[data-action]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          this.action(button.dataset.action!),
        ),
      );
    const version = ++this.renderVersion;
    requestAnimationFrame(() => {
      if (version !== this.renderVersion || this.overlay.hidden) return;
      this.overlay.classList.add("visible");
      const selector =
        mode === "menu" && this.focusReturnAction
          ? `[data-action="${this.focusReturnAction}"]`
          : ".button-primary,button:not(:disabled),input";
      this.overlay
        .querySelector<HTMLElement>(selector)
        ?.focus({ preventScroll: true });
      if (mode === "menu") this.focusReturnAction = undefined;
    });
  }
  private action(action: string) {
    audio.unlock();
    if (["levels", "help", "settings", "records"].includes(action))
      this.focusReturnAction = action;
    if (action.startsWith("start:")) {
      const level = Number(action.split(":")[1]);
      if (level <= saveStore.data.unlocked) {
        this.hideOverlay();
        this.callbacks.start(level);
      }
      return;
    }
    switch (action) {
      case "levels":
        this.showLevels();
        break;
      case "help":
        this.showHelp();
        break;
      case "settings":
        this.showSettings();
        break;
      case "records":
        this.showRecords();
        break;
      case "back":
        this.playing ? this.showPause() : this.showMenu();
        break;
      case "resume":
        this.hideOverlay();
        this.callbacks.resume();
        break;
      case "restart":
        this.hideOverlay();
        this.callbacks.restart();
        break;
      case "menu":
        this.playing = false;
        this.callbacks.menu();
        this.showMenu();
        break;
    }
  }
  private button(label: string, action: string, primary = false, extra = "") {
    return `<button class="${primary ? "button-primary" : "button-secondary"}" data-action="${action}" ${extra}>${label}${primary ? arrow : ""}</button>`;
  }
  private panel(
    eyebrow: string,
    title: string,
    description: string,
    body: string,
  ) {
    return `<section class="dialog-card"><div class="dialog-eyebrow">${eyebrow}</div><h2>${title}</h2>${description ? `<p class="dialog-description">${description}</p>` : ""}${body}</section>`;
  }
  showMenu() {
    this.playing = false;
    this.showHUD(false);
    const unlocked = saveStore.data.unlocked;
    this.render(
      `<section class="menu-copy"><div class="menu-eyebrow"><span></span> A LITTLE LEAF. A GREAT ADVENTURE.</div><div class="menu-title-lockup"><h1>苔光远行<span>MOSSLIGHT</span></h1><span class="title-spark">✦</span></div><p class="menu-description">循着微光，去世界的另一边。<br>和叶芽一起，跃入一场充满惊喜的像素冒险。</p><div class="menu-actions">${this.button(unlocked > 1 ? "继续冒险" : "开启冒险", `start:${unlocked}`, true)}${this.button('选择章节 <span class="button-count">03</span>', "levels")}</div><div class="menu-links"><button data-action="help">${svg('<path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/><circle cx="12" cy="12" r="10"/>')} 操作指南</button><button data-action="settings">${gear} 设置</button><button data-action="records">${svg('<path d="M8 3h8v8a4 4 0 0 1-8 0ZM8 6H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 0h8"/>')} 最佳成绩</button></div><div class="menu-footnote"><span class="keycap">A</span><span class="keycap">D</span> 移动 <span class="footnote-divider"></span><span class="keycap space">SPACE</span> 跳跃</div></section><aside class="world-caption"><span class="world-caption-icon">${leaf}</span><div><small>YOUR JOURNEY BEGINS HERE</small><strong>第一站 · 阳光草原</strong></div><span>01 / 03</span></aside><span class="menu-corner">手绘像素世界 · 原创音乐</span>`,
      "menu",
    );
  }
  private showLevels() {
    const descriptions = [
      "沿着金色星币，发现勇气的第一步。",
      "穿过荧光矿洞，听见遗迹的回声。",
      "跃上流动的云海，让小小梦想发光。",
    ];
    const levels = names
      .map((name, i) => {
        const locked = i + 1 > saveStore.data.unlocked;
        const record = saveStore.data.records[i + 1];
        return `<button class="level-card level-${i + 1} ${locked ? "locked" : ""}" data-action="start:${i + 1}" ${locked ? "disabled" : ""}><div class="level-illustration"><span>${icons[i]}</span><i></i><em></em><b>${locked ? "锁定" : record ? "已完成 ✓" : "已解锁"}</b></div><div class="level-content"><small>CHAPTER 0${i + 1}</small><h3>${name}</h3><p>${locked ? "完成上一章节后解锁" : descriptions[i]}</p>${record ? `<div class="level-records"><span><small>最高分</small><b>${record.score.toLocaleString()}</b></span><span><small>最快通关</small><b>${formatTime(record.time)}</b></span></div>` : `<span>${locked ? "◇ 完成前一章解锁" : "开始探索 →"}</span>`}</div></button>`;
      })
      .join("");
    this.render(
      this.panel(
        "THE FIELD JOURNAL",
        "三段旅途，同一束光。",
        "从柔软的草地，到天空尽头的古老城堡。",
        `<div class="level-grid">${levels}</div><div class="dialog-footer">${this.button("返回", "back")}</div>`,
      ),
    );
  }
  private showHelp() {
    this.render(
      this.panel(
        "A SMALL GUIDE TO A BIG WORLD",
        "每一次跳跃，都更接近远方。",
        "短按轻跳，长按高跳。离开边缘后仍有一瞬间可以起跳。",
        `<div class="help-grid"><div><kbd>A / D</kbd><kbd>← / →</kbd><span>左右移动</span></div><div><kbd>SPACE</kbd><kbd>W / ↑</kbd><span>跳跃 · 按住跳得更高</span></div><div><kbd>SHIFT</kbd><span>按住加速奔跑</span></div><div><kbd>ESC</kbd><kbd>R</kbd><span>暂停 / 重新开始</span></div></div><div class="help-tips"><p><b>✦ 收集与探索</b> 收集星币，从下方撞击发光方块。叶光道具能强化你，秘密藏在不起眼的角落。</p><p><b>↓ 踩踏与反弹</b> 从上方踩中敌人，借力跃向更高处。避开侧面碰撞和深坑。</p><p><b>⚑ 留住脚步</b> 点亮途中灯塔，失败后可从检查点重试。触碰终点门环进入下一章。</p><p class="help-mobile">触屏设备：左侧方向键移动，右侧跳跃与疾跑键可同时按住。</p></div><div class="dialog-footer">${this.button("记住了", "back", true)}</div>`,
      ),
    );
  }
  private showSettings() {
    const { music, sfx } = saveStore.data.settings;
    this.render(
      this.panel(
        "MAKE YOURSELF AT HOME",
        "让冒险，刚刚好。",
        "原创复古旋律与轻巧的声音反馈，可以分别调整。",
        `<div class="settings-grid"><div class="volume-settings">${this.volumeRow("music", "背景音乐", "为每一段旅途写下的旋律", music)}${this.volumeRow("sfx", "游戏音效", "每次跳跃、拾取与成长的回响", sfx)}</div><fieldset class="visual-settings"><legend>画面与舒适度</legend><label class="setting-switch"><span><b>屏幕震动</b><small>轻微的落地与受击反馈</small></span><input id="setting-shake" type="checkbox" role="switch" ${saveStore.data.settings.screenShake ? "checked" : ""}></label><label class="setting-switch"><span><b>减少动态效果</b><small>减弱闪烁、形变与环境动画，同时关闭震动</small></span><input id="setting-motion" type="checkbox" role="switch" ${saveStore.data.settings.reducedMotion ? "checked" : ""}></label><label class="setting-quality"><span><b>粒子与环境细节</b><small>精简模式适合性能较弱的设备</small></span><select id="setting-effects" aria-label="粒子与环境细节"><option value="full">完整</option><option value="low">精简</option></select></label></fieldset></div><div class="settings-note"><span class="status-dot"></span> 设置自动保存在当前浏览器${saveStore.available ? "" : " · 当前无法持久保存"}</div><div class="dialog-footer">${this.button("完成", "back", true)}</div>`,
      ),
    );
    const updateVisual = () => {
      saveStore.setSettings({
        screenShake:
          this.overlay.querySelector<HTMLInputElement>("#setting-shake")!
            .checked,
        reducedMotion:
          this.overlay.querySelector<HTMLInputElement>("#setting-motion")!
            .checked,
        effects: this.overlay.querySelector<HTMLSelectElement>(
          "#setting-effects",
        )!.value as "full" | "low",
      });
      this.applyVisualSettings();
      window.dispatchEvent(
        new CustomEvent("mosslight-settings", {
          detail: { ...saveStore.data.settings },
        }),
      );
    };
    this.overlay.querySelector<HTMLSelectElement>("#setting-effects")!.value =
      saveStore.data.settings.effects;
    this.overlay
      .querySelectorAll(".visual-settings input,.visual-settings select")
      .forEach((control) => control.addEventListener("change", updateVisual));
    (["music", "sfx"] as const).forEach((key) => {
      const slider = this.overlay.querySelector<HTMLInputElement>(
        `#volume-${key}`,
      )!;
      const value = this.overlay.querySelector<HTMLElement>(`#value-${key}`)!;
      const mute = this.overlay.querySelector<HTMLButtonElement>(
        `#mute-${key}`,
      )!;
      const update = (v: number) => {
        saveStore.setSettings({ [key]: v });
        audio.setVolumes(
          saveStore.data.settings.music,
          saveStore.data.settings.sfx,
        );
        slider.value = `${Math.round(v * 100)}`;
        value.textContent = `${Math.round(v * 100)}%`;
        mute.textContent = v === 0 ? "取消静音" : "静音";
        mute.setAttribute("aria-pressed", String(v === 0));
      };
      slider.addEventListener("input", () =>
        update(Number(slider.value) / 100),
      );
      slider.addEventListener("change", () => {
        if (key === "sfx") audio.play("coin");
      });
      mute.addEventListener("click", () =>
        update(
          saveStore.data.settings[key] === 0
            ? key === "music"
              ? 0.3
              : 0.65
            : 0,
        ),
      );
    });
  }
  private applyVisualSettings() {
    document.documentElement.classList.toggle(
      "reduce-motion",
      saveStore.data.settings.reducedMotion,
    );
    document.documentElement.classList.toggle(
      "low-effects",
      saveStore.data.settings.effects === "low",
    );
  }
  private volumeRow(
    key: string,
    title: string,
    description: string,
    value: number,
  ) {
    return `<div class="volume-row"><div><label for="volume-${key}">${title}</label><small>${description}</small></div><div class="volume-slider"><input id="volume-${key}" type="range" min="0" max="100" value="${Math.round(value * 100)}" aria-label="${title}音量"><output id="value-${key}">${Math.round(value * 100)}%</output><button id="mute-${key}" class="button-text" aria-pressed="${value === 0}">${value === 0 ? "取消静音" : "静音"}</button></div></div>`;
  }
  private showRecords() {
    const rows = names
      .map((name, i) => {
        const r = saveStore.data.records[i + 1];
        return `<tr><th scope="row"><i>${icons[i]}</i> ${name}</th><td>${r ? r.score.toLocaleString() : "—"}</td><td>${r ? r.coins : "—"}</td><td>${r ? formatTime(r.time) : "—"}</td></tr>`;
      })
      .join("");
    this.render(
      this.panel(
        "LITTLE MOMENTS, WELL REMEMBERED",
        "把闪光的瞬间，留在这里。",
        "每章最高得分、最多星币和最快通关分别记录。",
        `<table class="records-table"><thead><tr><th>章节</th><th>最高得分</th><th>星币纪录</th><th>最快用时</th></tr></thead><tbody>${rows}</tbody></table><p class="save-note">记录保存在此设备的浏览器中。${saveStore.available ? "" : "当前无法持久保存。"}</p><div class="dialog-footer">${this.button("返回", "back")}</div>`,
      ),
    );
  }
  showPause() {
    this.playing = true;
    this.render(
      this.panel(
        "TAKE A LITTLE BREATH",
        "旅途，可以慢一点。",
        "风还在吹，小小的冒险家在等你。",
        `<div class="stack-actions">${this.button("继续冒险", "resume", true)}${this.button("重新开始本关", "restart")}<div class="split-actions">${this.button("声音与画面", "settings")}${this.button("操作指南", "help")}</div>${this.button("返回主菜单", "menu")}</div>`,
      ),
      "pause",
    );
  }
  showFailure(
    info: { reason?: "pit" | "enemy" | "hazard"; checkpoint?: boolean } = {},
  ) {
    this.playing = true;
    this.render(
      this.panel(
        "EVERY ADVENTURER STARTS AGAIN",
        "歇一歇，再出发。",
        info.reason === "pit"
          ? "掉入了深坑。靠近边缘再起跳，按住跳跃能飞得更远。"
          : info.reason === "hazard"
            ? "碰到了晶刺。观察落点，给下一次跳跃留出空间。"
            : "与敌人碰撞耗尽了生命。试着从上方踩中它们。",
        `<div class="result-emblem">${leaf}</div><p class="checkpoint-hint">${info.checkpoint ? "苔光灯已点亮 · 从检查点继续" : "从本关起点重新出发"}<br><kbd>Enter</kbd> 立即重试</p><div class="stack-actions">${this.button("再次出发", "restart", true)}${this.button("返回主菜单", "menu")}</div>`,
      ),
      "failure",
    );
  }
  showComplete(result: Result) {
    this.playing = true;
    const last = result.level === 3;
    this.render(
      this.panel(
        last
          ? "THE LIGHT WAS WITHIN YOU ALL ALONG"
          : `CHAPTER 0${result.level} · COMPLETE`,
        last ? "微光，终于照亮了远方。" : "这一程，闪闪发光。",
        last
          ? "草地、洞穴与云海，都记住了你的脚步。谢谢你陪叶芽走完这场冒险。"
          : `${names[result.level - 1]}已完成。新的风景，正在前方等你。`,
        `<div class="result-stars">✧ <span>✦</span> ✧</div><div class="result-stats"><div><small>本次得分</small><strong>${result.score.toLocaleString()}</strong></div><div><small>收集星币</small><strong>${result.coins}</strong></div><div><small>冒险用时</small><strong>${formatTime(result.time)}</strong></div></div>${!last ? `<div class="unlock-note">${icons[result.level]} 已解锁 · ${names[result.level]}</div>` : '<div class="unlock-note">三章旅途已完成 · 所有关卡自由探索</div>'}<div class="stack-actions">${last ? this.button("再访这个世界", "menu", true) : this.button("前往下一章", `start:${result.level + 1}`, true)}<div class="split-actions">${this.button("再玩一次", "restart")}${this.button("返回主菜单", "menu")}</div></div>`,
      ),
      "complete",
    );
  }
  hideOverlay() {
    this.overlay.hidden = true;
    this.overlay.classList.remove("visible");
    this.hud.inert = false;
    if (
      document.activeElement instanceof HTMLElement &&
      this.overlay.contains(document.activeElement)
    )
      document.activeElement.blur();
    this.playing = true;
    this.controls.hidden = !this.playing;
    this.resetTouch();
  }
  showHUD(show: boolean) {
    this.hud.hidden = !show;
    this.controls.hidden = !show || this.isOpen;
    document.getElementById("game-shell")?.classList.toggle("is-playing", show);
  }
  updateHUD(data: HUD) {
    const remaining = Math.ceil(data.powerSeconds || 0);
    const progress = Math.round(
      Math.max(0, Math.min(1, data.progress || 0)) * 100,
    );
    const key = `${data.level}|${data.health}|${data.coins}|${data.score}|${Math.floor(data.time)}|${data.powered}|${remaining}|${data.checkpoint}|${progress}|${data.invincible}`;
    if (key === this.cachedHUD) return;
    this.cachedHUD = key;
    if (this.lastHUD && !saveStore.data.settings.reducedMotion) {
      if (data.coins > this.lastHUD.coins)
        this.root.querySelector("#hud-coins")?.animate(
          [
            { transform: "scale(1.2)", color: "#c69a36" },
            { transform: "scale(1)", color: "#6d7851" },
          ],
          { duration: 180 },
        );
    }
    this.lastHUD = { ...data };
    this.root.querySelector("#hud-level")!.textContent = names[data.level - 1];
    this.root.querySelector(".hud-level-number")!.textContent =
      `0${data.level}`;
    const hearts = this.root.querySelector("#hud-health")!;
    hearts.textContent = `${"♥ ".repeat(Math.max(0, data.health))}${"♡ ".repeat(Math.max(0, 3 - data.health))}`;
    hearts.setAttribute("aria-label", `生命值 ${data.health}`);
    hearts.classList.toggle("recovering", !!data.invincible);
    hearts.setAttribute(
      "title",
      data.invincible ? "受伤保护中" : `生命 ${data.health} / 3`,
    );
    this.root.querySelector("#hud-coins")!.textContent = data.coins
      .toString()
      .padStart(2, "0");
    this.root.querySelector("#hud-score")!.textContent = data.score
      .toString()
      .padStart(5, "0");
    this.root.querySelector("#hud-time")!.textContent = formatTime(data.time);
    (this.root.querySelector("#hud-power") as HTMLElement).hidden =
      !data.powered;
    this.root.querySelector("#hud-power")!.textContent =
      `✦ 叶光护佑${remaining ? ` · ${remaining} 秒` : " · 强化中"}`;
    this.root.querySelector("#hud-checkpoint")!.textContent = data.checkpoint
      ? "✦ 苔光灯已点亮"
      : "◇ 前往苔光灯";
    (this.root.querySelector("#hud-progress") as HTMLElement).style.width =
      `${progress}%`;
  }
  toast(text: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastNode.textContent = text;
    this.toastNode.classList.add("show");
    this.toastTimer = setTimeout(
      () => this.toastNode.classList.remove("show"),
      2800,
    );
  }
  destroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.resetTouch();
    this.root.replaceChildren();
  }
}
