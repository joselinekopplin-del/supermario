interface ObservedPlayer {
  level: number;
  checkpoint: boolean;
  x: number;
  vx: number;
}

/** Read-only steering for the cave lantern. The capture stays engaged until the
 * actual checkpoint lights, even when a delayed observation overshoots its area.
 * A 20 px target band leaves braking room inside the lantern's trigger radius.
 */
export function lanternControl(state: ObservedPlayer, engaged: boolean) {
  const active =
    state.level === 2 &&
    !state.checkpoint &&
    (engaged || (state.x >= 1800 && state.x <= 1920));
  if (!active) return { active: false, left: false, right: true };
  if (state.x > 1840) return { active: true, left: true, right: false };
  if (state.x < 1820) return { active: true, left: false, right: true };
  return {
    active: true,
    left: state.vx > 5,
    right: state.vx < -5,
  };
}
