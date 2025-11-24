import { world } from "../world";
import { PLAYER_CONFIG } from "../../config";
import { HUDManager } from "../../hud_manager";

export class PlayerStateSystem {
  constructor(private hudManager: HUDManager) {}

  public update(dt: number) {
    const players = world.with("health", "stamina");

    for (const entity of players) {
        const isDead = entity.health.current <= 0;
        const isFullHealth = entity.health.current >= entity.health.max;
        const isFullStamina = entity.stamina.current >= entity.stamina.max;

        // 1. Health Regeneration (if not dead)
        if (!isDead && isFullStamina && !isFullHealth) {
             entity.health.current += PLAYER_CONFIG.HEALTH_REGENERATION_RATE * dt;
             if (entity.health.current > entity.health.max) {
                 entity.health.current = entity.health.max;
             }
        }
        
        // 2. Death Logic
        if (isDead) {
            // Ensure health doesn't dip below 0
            entity.health.current = 0;
            
            // Trigger Death UI
            this.hudManager.showDeathScreen();
        } else {
            // Ensure alive state UI is correct
            // Note: Efficient way would be event-based or state tracking,
            // but for now calling hideDeathScreen is safe if already hidden.
            this.hudManager.hideDeathScreen();
        }
    }
  }
}

