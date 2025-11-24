import { world } from "../world";
import * as YUKA from "yuka";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class EnemyAISystem {
  
  constructor() {}

  public update() {
    const playerEntity = world.with("player", "transform").first;
    if (!playerEntity) return;

    const playerPos = playerEntity.transform.mesh.getAbsolutePosition();
    const AGGRO_RADIUS = 20;

    const enemies = world.with("enemy", "yuka", "ai", "transform", "health");

    for (const entity of enemies) {
      if (entity.health.current <= 0) {
          entity.ai.state = "dead";
          entity.yuka.vehicle.steering.clear();
          entity.yuka.vehicle.velocity.set(0, 0, 0);
          continue;
      }
      
      // CombatSystem manages the 'attack' -> 'chase' transition.
      if (entity.ai.state === "attack") {
          entity.yuka.vehicle.steering.clear();
          entity.yuka.vehicle.velocity.set(0, 0, 0);
          continue;
      }

      const enemyPos = entity.transform.mesh.getAbsolutePosition();
      const distToPlayer = Vector3.Distance(playerPos, enemyPos);

      // Determine State
      if (distToPlayer < AGGRO_RADIUS) {
          entity.ai.state = "chase";
      } else {
          entity.ai.state = "idle"; 
      }

      // Check for behaviors
      if (!entity.yuka.behaviors) {
          // Should have been initialized by assembler, but safe fallback or log warning
          continue;
      }

      const { seek, wander } = entity.yuka.behaviors;
      const vehicle = entity.yuka.vehicle;

      // Update Targets
      if (entity.ai.state === "chase") {
          // Update this specific entity's seek target
          seek.target.set(playerPos.x, playerPos.y, playerPos.z);
          
          if (!vehicle.steering.behaviors.includes(seek)) {
              vehicle.steering.clear();
              vehicle.steering.add(seek);
          }
      } else {
          if (!vehicle.steering.behaviors.includes(wander)) {
              vehicle.steering.clear();
              vehicle.steering.add(wander);
          }
      }
    }
  }
}
