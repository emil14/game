import { world } from "../world";
import { PlayerManager } from "../../player_manager";

export class HealthSystem {
  constructor(private playerManager: PlayerManager) {}

  public update() {
    // Entities with health + player tag
    const players = world.with("health", "player");
    for (const entity of players) {
        // Player regeneration logic is currently in PlayerManager, 
        // but we can sync or move it here. 
        // For now, let's sync ECS state <-> PlayerManager state
        
        // Write: Manager -> ECS (Source of truth is currently Manager)
        entity.health.current = this.playerManager.getCurrentHealth();
        entity.health.max = this.playerManager.getMaxHealth();
    }

    // Enemies
    const enemies = world.with("health", "enemy");
    for (const entity of enemies) {
       // Logic for enemy health (e.g. death check) can go here
       if (entity.health.current <= 0) {
           // Handle death state
           if (entity.ai) {
               entity.ai.state = "dead";
           }
       }
    }
  }
}

