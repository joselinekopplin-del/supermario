import Phaser from "phaser";

export interface WorldArtOptions {
  reducedMotion?: boolean;
  effectsQuality?: "full" | "low";
}
type AmbientState = {
  options: WorldArtOptions;
  tweens: Phaser.Tweens.Tween[];
  details: Phaser.GameObjects.Components.Visible[];
};
const ambience = new WeakMap<Phaser.Scene, AmbientState>();

/** Each level begins a fresh, bounded registry; removed scene objects are not retained. */
export function beginWorldArt(scene: Phaser.Scene, options: WorldArtOptions) {
  ambience.set(scene, { options, tweens: [], details: [] });
}

export function ambientTween(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Phaser.Tweens.Tween {
  const tween = scene.tweens.add(config);
  const state = ambience.get(scene);
  if (state) {
    state.tweens.push(tween);
    if (state.options.reducedMotion || state.options.effectsQuality === "low")
      tween.pause();
  }
  return tween;
}

export function ambientDetail<T extends Phaser.GameObjects.Components.Visible>(
  scene: Phaser.Scene,
  detail: T,
): T {
  const state = ambience.get(scene);
  if (state) {
    state.details.push(detail);
    detail.setVisible(state.options.effectsQuality !== "low");
  }
  return detail;
}

/** Settings changes take effect immediately without restarting a level. */
export function applyWorldPreferences(
  scene: Phaser.Scene,
  options: WorldArtOptions,
) {
  const state = ambience.get(scene);
  if (!state) return;
  state.options = options;
  for (const detail of state.details)
    detail.setVisible(options.effectsQuality !== "low");
  for (const tween of state.tweens) {
    if (options.reducedMotion || options.effectsQuality === "low")
      tween.pause();
    else tween.resume();
  }
}

export function worldMotionEnabled(scene: Phaser.Scene) {
  const options = ambience.get(scene)?.options;
  return !options?.reducedMotion && options?.effectsQuality !== "low";
}
