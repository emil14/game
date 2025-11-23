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
          continue;
      }

      const enemyPos = entity.transform.mesh.getAbsolutePosition();
      const distToPlayer = Vector3.Distance(playerPos, enemyPos);
      const AGGRO_RADIUS = 20;

      const vehicle = entity.yuka.vehicle;
      
      // Determine State
      if (distToPlayer < AGGRO_RADIUS) {
          entity.ai.state = "chase";
          entity.enemy.isAggro = true;
      } else {
          entity.ai.state = "idle"; // or wander
          entity.enemy.isAggro = false;
      }

      // Apply Behaviors based on State
      // Note: In a robust system, we'd manage behavior instances per entity or use a BehaviorComponent.
      // For now, we manipulate the steering list.
      
      const hasSeek = vehicle.steering.behaviors.some(b => b instanceof YUKA.SeekBehavior);
      const hasWander = vehicle.steering.behaviors.some(b => b instanceof YUKA.WanderBehavior);

      if (entity.ai.state === "chase") {
          // Ideally, we should have a unique SeekBehavior per entity if they target different things,
          // but here they all target the player.
          // However, YUKA behaviors are objects. If we reuse the SAME behavior instance for all,
          // they modify the same target reference. That works for "Player".
          
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

