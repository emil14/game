import { world } from "../world";

export class GameFlowSystem {
  constructor() {
    // Ensure WorldState entity exists
    if (!world.with("worldState").first) {
        world.add({
            worldState: { isInFightMode: false }
        });
    }
  }

  public update() {
    const worldStateEntity = world.with("worldState").first;
    if (!worldStateEntity) return; // Should not happen given constructor

    // 1. Check for Aggro
    let isAnyEnemyAggro = false;
    const aggroEnemies = world.with("enemy", "ai").where(e => e.ai.state === "chase" || e.ai.state === "attack");
    for (const _e of aggroEnemies) {
        isAnyEnemyAggro = true;
        break;
    }

    // 2. Check Player Health (Game Over condition)
    const player = world.with("player", "health").first;
    const currentHealth = player?.health.current ?? 0;
    
    // 3. Update State
    // Transition to Fight Mode if any enemy is aggro
    // Transition out if no enemies aggro OR player is dead
    if (isAnyEnemyAggro && !worldStateEntity.worldState.isInFightMode) {
        worldStateEntity.worldState.isInFightMode = true;
        // console.log("Entering Fight Mode"); // Event hook potentially
    } else if (worldStateEntity.worldState.isInFightMode) {
        if (!isAnyEnemyAggro || currentHealth <= 0) {
            worldStateEntity.worldState.isInFightMode = false;
            // console.log("Exiting Fight Mode"); // Event hook potentially
        }
    }
  }
}

