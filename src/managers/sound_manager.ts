import { AudioEngineV2, CreateSoundAsync, Sound } from "@babylonjs/core";

export class SoundManager {
  private readonly audioEngine: AudioEngineV2;
  private sounds: Map<string, Sound> = new Map();

  constructor(audioEngine: AudioEngineV2) {
    this.audioEngine = audioEngine;
  }

  public async loadSound(name: string, url: string): Promise<void> {
    if (this.sounds.has(name)) {
      console.warn(`Sound ${name} already loaded.`);
      return;
    }
    await CreateSoundAsync(name, url);
    await this.audioEngine.unlockAsync();
    await this.audioEngine.resumeAsync();
    console.info(`Sound ${name} loaded.`);
  }

  public playSound(name: string): void {
    const sound = this.sounds.get(name);
    if (!sound) {
      throw new Error(`Sound ${name} not found or not loaded.`);
    }
    sound.play();
  }
}
