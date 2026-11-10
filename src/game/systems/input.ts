import Phaser from "phaser";
import { touchState } from "../../ui/GameUI";
import type { Input } from "../physics/motion";
export class Controls {
  keys: Record<string, Phaser.Input.Keyboard.Key>;
  private jumpPressed = false;
  private jumpReleased = false;
  private seen = new WeakSet<KeyboardEvent>();
  constructor(private scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys(
      "A,D,W,LEFT,RIGHT,UP,SPACE,SHIFT,ESC,R",
    ) as typeof this.keys;
    for (const key of ["SPACE", "W", "UP"]) {
      scene.input.keyboard!.on(`keydown-${key}`, (event: KeyboardEvent) => {
        if (!event.repeat && !this.seen.has(event)) {
          this.seen.add(event);
          this.jumpPressed = true;
        }
      });
      scene.input.keyboard!.on(`keyup-${key}`, (event: KeyboardEvent) => {
        if (!this.seen.has(event)) {
          this.seen.add(event);
          this.jumpReleased = true;
        }
      });
    }
  }
  setGameplayCapture(enabled: boolean) {
    const keyboard = this.scene.input.keyboard!;
    keyboard.clearCaptures();
    if (enabled) keyboard.addCapture("A,D,W,LEFT,RIGHT,UP,SPACE,SHIFT,ESC,R");
  }
  read(): Input {
    const k = this.keys;
    return {
      left: k.A.isDown || k.LEFT.isDown || touchState.left,
      right: k.D.isDown || k.RIGHT.isDown || touchState.right,
      jump: k.W.isDown || k.UP.isDown || k.SPACE.isDown || touchState.jump,
      run: k.SHIFT.isDown || touchState.run,
    };
  }
  consume(): Input {
    const input = this.read();
    input.jumpPressed = this.jumpPressed || touchState.jumpPressed;
    input.jumpReleased =
      !input.jump && (this.jumpReleased || touchState.jumpReleased);
    this.jumpPressed =
      this.jumpReleased =
      touchState.jumpPressed =
      touchState.jumpReleased =
        false;
    return input;
  }
  reset() {
    Object.values(this.keys).forEach((k) => k.reset());
    touchState.left =
      touchState.right =
      touchState.jump =
      touchState.run =
        false;
    this.jumpPressed =
      this.jumpReleased =
      touchState.jumpPressed =
      touchState.jumpReleased =
        false;
  }
}
