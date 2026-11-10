export type Theme = "meadow" | "cave" | "sky";

/** World-space pixels. Rectangles use their top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Platform extends Rect {
  move?: { axis: "x" | "y"; distance: number; duration: number };
}
export interface Level {
  id: number;
  name: string;
  subtitle: string;
  theme: Theme;
  width: number;
  spawn: { x: number; y: number };
  platforms: Platform[];
  coins: { x: number; y: number; hidden?: boolean }[];
  blocks: { x: number; y: number; kind: "reward" | "brick" | "power" }[];
  enemies: {
    x: number;
    y: number;
    type: "beetle" | "hopper" | "flyer";
    range: number;
  }[];
  checkpoint: { x: number; y: number };
  goal: { x: number; y: number };
  chests: { x: number; y: number }[];
  hazards: Rect[];
  signs: { x: number; y: number; text: string }[];
}
