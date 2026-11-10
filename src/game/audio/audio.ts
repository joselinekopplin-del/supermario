export type Sound =
  | "jump"
  | "coin"
  | "bump"
  | "stomp"
  | "hurt"
  | "power"
  | "win"
  | "fail"
  | "checkpoint";
type Theme = "meadow" | "cave" | "sky";
// Original three-part miniatures. MIDI notes are scheduled ahead on the audio clock.
const melodies: Record<Theme, number[]> = {
  meadow: [
    72, 0, 76, 79, 81, 79, 76, 0, 74, 0, 77, 81, 79, 77, 74, 0, 72, 76, 79, 84,
    83, 79, 76, 0, 74, 77, 79, 76, 74, 0, 72, 0,
  ],
  cave: [
    64, 0, 0, 71, 67, 0, 66, 0, 64, 0, 0, 62, 59, 0, 62, 0, 67, 0, 0, 74, 71, 0,
    69, 0, 67, 66, 64, 0, 62, 0, 59, 0,
  ],
  sky: [
    79, 83, 86, 0, 88, 86, 83, 79, 81, 84, 88, 0, 91, 88, 84, 81, 83, 86, 90, 0,
    91, 90, 86, 83, 81, 79, 78, 81, 79, 0, 0, 0,
  ],
};
const bass: Record<Theme, number[]> = {
  meadow: [48, 53, 45, 55],
  cave: [40, 43, 36, 38],
  sky: [55, 57, 59, 50],
};
const cooldown: Record<Sound, number> = {
  jump: 0.055,
  coin: 0.035,
  bump: 0.065,
  stomp: 0.06,
  hurt: 0.15,
  power: 0.3,
  checkpoint: 0.3,
  win: 0.8,
  fail: 0.8,
};

interface Voice {
  oscillator: OscillatorNode;
  gain: GainNode;
  music: boolean;
  starts: number;
  ends: number;
}

class AudioEngine {
  private context?: AudioContext;
  private musicBus?: GainNode;
  private sfxBus?: GainNode;
  private master?: DynamicsCompressorNode;
  private voices = new Set<Voice>();
  private lastSound = new Map<Sound, number>();
  private pausedStep = 0;
  private timer?: ReturnType<typeof setInterval>;
  private next = 0;
  private step = 0;
  private musicVolume = 0.3;
  private sfxVolume = 0.65;
  private theme: Theme = "meadow";
  private playing = false;
  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.musicBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      this.master = this.context.createDynamicsCompressor();
      this.master.threshold.value = -18;
      this.master.knee.value = 16;
      this.master.ratio.value = 4;
      this.master.attack.value = 0.003;
      this.master.release.value = 0.12;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.context.destination);
      this.setVolumes(this.musicVolume, this.sfxVolume);
    }
    if (this.context.state === "suspended") void this.context.resume();
  }
  setVolumes(music: number, sfx: number) {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    const now = this.context?.currentTime || 0;
    this.musicBus?.gain.setTargetAtTime(this.musicVolume * 0.38, now, 0.025);
    this.sfxBus?.gain.setTargetAtTime(this.sfxVolume * 0.5, now, 0.025);
  }
  private tone(
    hz: number,
    duration: number,
    at: number,
    type: OscillatorType,
    volume: number,
    music = false,
    to?: number,
  ) {
    const ctx = this.context;
    const bus = music ? this.musicBus : this.sfxBus;
    if (!ctx || !bus) return;
    if ((music ? this.musicVolume : this.sfxVolume) === 0) return;
    let sameBus = 0;
    for (const voice of this.voices) if (voice.music === music) sameBus++;
    if (sameBus >= (music ? 8 : 12)) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain);
    gain.connect(bus);
    const voice: Voice = {
      oscillator: osc,
      gain,
      music,
      starts: at,
      ends: at + duration + 0.02,
    };
    this.voices.add(voice);
    osc.start(at);
    osc.stop(at + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
  }
  startMusic(theme: Theme) {
    this.stopMusic();
    this.unlock();
    this.theme = theme;
    this.playing = true;
    this.step = 0;
    this.pausedStep = 0;
    this.next = (this.context?.currentTime || 0) + 0.04;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.playing = false;
    this.cancelVoices(true);
  }
  pauseMusic() {
    // Resume from the next musical beat, instead of repeating the introduction.
    this.pausedStep = this.step;
    this.stopMusic();
    this.cancelVoices(false);
  }
  resumeMusic(theme: Theme) {
    if (theme !== this.theme) {
      this.startMusic(theme);
      return;
    }
    this.stopMusic();
    this.unlock();
    this.step = this.pausedStep;
    this.next = (this.context?.currentTime || 0) + 0.035;
    this.playing = true;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }
  stopAll() {
    this.stopMusic();
    this.cancelVoices(false);
    this.lastSound.clear();
  }
  private cancelVoices(music: boolean) {
    const now = this.context?.currentTime || 0;
    for (const voice of this.voices) {
      if (voice.music !== music) continue;
      const parameter = voice.gain.gain;
      if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
      else {
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(parameter.value, now);
      }
      parameter.linearRampToValueAtTime(0, now + 0.012);
      voice.oscillator.stop(now + 0.015);
      // Remove immediately from scheduler accounting; onended releases nodes.
      this.voices.delete(voice);
    }
  }
  /** Read-only diagnostics for regression tests; no audio state is changed. */
  diagnostics() {
    return {
      playing: this.playing,
      schedulerCount: this.timer ? 1 : 0,
      musicVoices: Array.from(this.voices).filter((v) => v.music).length,
      sfxVoices: Array.from(this.voices).filter((v) => !v.music).length,
      step: this.step,
      contextState: this.context?.state || "locked",
    };
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || !this.playing || ctx.state !== "running") return;
    const beat =
      this.theme === "cave" ? 0.21 : this.theme === "sky" ? 0.145 : 0.17;
    if (this.next < ctx.currentTime - 0.1) this.next = ctx.currentTime + 0.02;
    while (this.next < ctx.currentTime + 0.12) {
      const i = this.step % 32;
      const note = melodies[this.theme][i];
      if (note)
        this.tone(
          440 * 2 ** ((note - 69) / 12),
          beat * 1.3,
          this.next,
          "square",
          0.085,
          true,
        );
      if (i % 4 === 0)
        this.tone(
          440 * 2 ** ((bass[this.theme][Math.floor(i / 8)] - 69) / 12),
          beat * 3,
          this.next,
          "triangle",
          0.34,
          true,
        );
      if (i % 4 === 2 && this.theme !== "cave")
        this.tone(110, 0.07, this.next, "triangle", 0.14, true, 45);
      if (note && i % 8 === 4)
        this.tone(
          440 * 2 ** ((note - 81) / 12),
          beat * 2.2,
          this.next,
          this.theme === "cave" ? "sine" : "triangle",
          0.045,
          true,
        );
      this.next += beat;
      this.step++;
    }
  }
  play(name: Sound) {
    if (
      !this.context ||
      this.context.state !== "running" ||
      this.sfxVolume === 0
    )
      return;
    const at = this.context.currentTime;
    if (at - (this.lastSound.get(name) ?? -Infinity) < cooldown[name]) return;
    this.lastSound.set(name, at);
    if (name === "fail" || name === "win" || name === "hurt")
      this.cancelVoices(false);
    const arpeggio = (
      notes: number[],
      speed = 0.085,
      type: OscillatorType = "square",
    ) =>
      notes.forEach((hz, i) => this.tone(hz, 0.17, at + i * speed, type, 0.2));
    switch (name) {
      case "jump":
        this.tone(250, 0.15, at, "square", 0.16, false, 660);
        break;
      case "coin":
        arpeggio([988, 1480], 0.065, "triangle");
        break;
      case "bump":
        this.tone(160, 0.12, at, "triangle", 0.4, false, 60);
        break;
      case "stomp":
        this.tone(420, 0.13, at, "square", 0.2, false, 85);
        break;
      case "hurt":
        arpeggio([300, 180, 100], 0.055, "sawtooth");
        break;
      case "power":
        arpeggio([392, 494, 587, 784, 988, 1174]);
        break;
      case "checkpoint":
        arpeggio([523, 659, 784, 1047], 0.12, "triangle");
        break;
      case "win":
        arpeggio([523, 659, 784, 1047, 784, 1047, 1319], 0.12);
        break;
      case "fail":
        arpeggio([392, 349, 294, 196], 0.19, "triangle");
        break;
    }
  }
}
export const audio = new AudioEngine();
