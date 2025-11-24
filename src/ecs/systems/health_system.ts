import { world } from "../world";
import { PlayerManager } from "../../player_manager";

export class HealthSystem {
  // playerManager kept for potential future hybrid needs, but currently unused
  constructor(private _playerManager: PlayerManager) {}

  public update() {
    // Entities with health + player tag
    const players = world.with("health", "player");
    for (const _entity of players) {
        // No-op for now, waiting for pure ECS logic
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
