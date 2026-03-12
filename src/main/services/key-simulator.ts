import { keyboard, mouse, Key, Button, Point } from '@nut-tree-fork/nut-js'

keyboard.config.autoDelayMs = 50

export class KeySimulator {
  /** Simulate Win+H to toggle Windows voice typing */
  async toggleVoiceTyping(): Promise<void> {
    await keyboard.pressKey(Key.LeftSuper, Key.H)
    await keyboard.releaseKey(Key.LeftSuper, Key.H)
  }

  /** Simulate Escape */
  async pressEscape(): Promise<void> {
    await keyboard.pressKey(Key.Escape)
    await keyboard.releaseKey(Key.Escape)
  }

  /** Simulate Enter */
  async pressEnter(): Promise<void> {
    await keyboard.pressKey(Key.Enter)
    await keyboard.releaseKey(Key.Enter)
  }

  /** Move mouse to screen coordinates and click */
  async clickAt(x: number, y: number): Promise<void> {
    await mouse.setPosition(new Point(x, y))
    await mouse.click(Button.LEFT)
  }

  /** Full voice-stop: Win+H -> wait 1s -> Escape */
  async stopVoiceTyping(): Promise<void> {
    await this.toggleVoiceTyping()
    await new Promise((r) => setTimeout(r, 1000))
    await this.pressEscape()
  }
}
