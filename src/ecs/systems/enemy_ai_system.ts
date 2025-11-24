import { world } from "../world";
import * as YUKA from "yuka";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class EnemyAISystem {
  private seekBehavior: YUKA.SeekBehavior;
  private wanderBehavior: YUKA.WanderBehavior;

  constructor() {
    this.seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
    this.wanderBehavior = new YUKA.WanderBehavior();
  }

  public update() {
    const playerEntity = world.with("player", "transform").first;
    if (!playerEntity) return;

    const playerPos = playerEntity.transform.mesh.getAbsolutePosition();
    // Update the shared seek target
    this.seekBehavior.target.set(playerPos.x, playerPos.y, playerPos.z);

    const enemies = world.with("enemy", "yuka", "ai", "transform", "health");

    for (const entity of enemies) {
      if (entity.health.current <= 0) {
          entity.ai.state = "dead";
          // Clear behaviors if dead
          entity.yuka.vehicle.steering.clear();
          entity.yuka.vehicle.velocity.set(0, 0, 0);
          continue;
      }
      
      // CRITICAL FIX: Do not override 'attack' state. 
      // CombatSystem manages the 'attack' -> 'chase' transition.
      if (entity.ai.state === "attack") {
          // Stop moving while attacking (optional, but good for melee)
          entity.yuka.vehicle.steering.clear();
          entity.yuka.vehicle.velocity.set(0, 0, 0);
          continue;
      }

      const enemyPos = entity.transform.mesh.getAbsolutePosition();
      const distToPlayer = Vector3.Distance(playerPos, enemyPos);
      const AGGRO_RADIUS = 20;

      const vehicle = entity.yuka.vehicle;
      
      // Determine State
      if (distToPlayer < AGGRO_RADIUS) {
          entity.ai.state = "chase";
      } else {
          entity.ai.state = "idle"; // or wander
      }

      // Apply Behaviors based on State
      const hasSeek = vehicle.steering.behaviors.some(b => b instanceof YUKA.SeekBehavior);
      const hasWander = vehicle.steering.behaviors.some(b => b instanceof YUKA.WanderBehavior);

      if (entity.ai.state === "chase") {
          if (!hasSeek) {
             vehicle.steering.clear();
             vehicle.steering.add(this.seekBehavior);
          }
      } else {
          if (!hasWander) {
              vehicle.steering.clear();
              vehicle.steering.add(this.wanderBehavior);
          }
      }
    }
  }
}
