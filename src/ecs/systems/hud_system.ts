import { world } from "../world";
import { HUDManager } from "../../hud_manager";

export class HUDSystem {
  constructor(private hudManager: HUDManager) {}

  public update() {
    // 1. Player Stats
    const player = world.with("player", "health", "stamina").first;
    if (player) {
        this.hudManager.updatePlayerStats(
          player.health.current,
          player.health.max,
          player.stamina.current,
          player.stamina.max
        );
    }
    
    // 2. FPS
    this.hudManager.updateFPS();

    // 3. Game Over Screen (Example of logic moving here)
    if (player && player.health.current <= 0) {
        this.hudManager.showDeathScreen();
    } else {
        this.hudManager.hideDeathScreen();
    }
  }
}

