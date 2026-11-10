export interface LevelRecord {
  score: number;
  coins: number;
  time: number;
}
export interface Settings {
  music: number;
  sfx: number;
  screenShake: boolean;
  reducedMotion: boolean;
  effects: "full" | "low";
}
export interface SaveData {
  unlocked: number;
  records: Record<number, LevelRecord>;
  settings: Settings;
}
const KEY = "mosslight-save-v1";
const defaults = (): SaveData => ({
  unlocked: 1,
  records: {},
  settings: {
    music: 0.3,
    sfx: 0.65,
    screenShake: true,
    reducedMotion: false,
    effects: "full",
  },
});
const finite = (
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, value))
    : fallback;

class SaveStore {
  data: SaveData = defaults();
  available = true;
  constructor() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object") return;
      this.data.unlocked = Math.max(1, Math.floor(finite(raw.unlocked, 1, 3)));
      this.data.settings.music = finite(raw.settings?.music, 0.3, 1);
      this.data.settings.sfx = finite(raw.settings?.sfx, 0.65, 1);
      if (typeof raw.settings?.screenShake === "boolean")
        this.data.settings.screenShake = raw.settings.screenShake;
      if (typeof raw.settings?.reducedMotion === "boolean")
        this.data.settings.reducedMotion = raw.settings.reducedMotion;
      if (raw.settings?.effects === "low") this.data.settings.effects = "low";
      for (let level = 1; level <= 3; level++) {
        const r = raw.records?.[level];
        if (r && typeof r === "object")
          this.data.records[level] = {
            score: finite(r.score, 0),
            coins: finite(r.coins, 0),
            time: finite(r.time, 0),
          };
      }
    } catch {
      this.available = false;
    }
  }
  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      this.available = true;
    } catch {
      this.available = false;
    }
  }
  setSettings(settings: Partial<Settings>) {
    if (settings.music !== undefined)
      this.data.settings.music = finite(
        settings.music,
        this.data.settings.music,
        1,
      );
    if (settings.sfx !== undefined)
      this.data.settings.sfx = finite(settings.sfx, this.data.settings.sfx, 1);
    if (typeof settings.screenShake === "boolean")
      this.data.settings.screenShake = settings.screenShake;
    if (typeof settings.reducedMotion === "boolean")
      this.data.settings.reducedMotion = settings.reducedMotion;
    if (settings.effects === "full" || settings.effects === "low")
      this.data.settings.effects = settings.effects;
    this.persist();
  }
  complete(level: number, score: number, coins: number, time: number) {
    if (!Number.isInteger(level) || level < 1 || level > 3) return;
    const old = this.data.records[level];
    this.data.records[level] = {
      score: Math.max(old?.score || 0, finite(score, 0)),
      coins: Math.max(old?.coins || 0, finite(coins, 0)),
      time: old?.time
        ? Math.min(old.time, finite(time, old.time))
        : finite(time, 0),
    };
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(3, level + 1));
    this.persist();
  }
}
export const saveStore = new SaveStore();
