import { world } from "../world";
import { PlayerManager } from "../../player_manager";

export class HealthSystem {
  constructor(private playerManager: PlayerManager) {}

  public update() {
    // Entities with health + player tag
    const players = world.with("health", "player");
    for (const entity of players) {
        // We no longer sync from Manager to ECS.
        // ECS is the source of truth.
        
        // Eventually, death logic should happen here
        // if (entity.health.current <= 0) {
        //     // Trigger death event
        // }
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
