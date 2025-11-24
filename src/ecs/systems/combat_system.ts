import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

// Helper type for an entity with specific components
type EnemyEntity = typeof world.entities[number] & {
    ai: NonNullable<typeof world.entities[number]["ai"]>;
    combat: NonNullable<typeof world.entities[number]["combat"]>;
    transform: NonNullable<typeof world.entities[number]["transform"]>;
    enemy: NonNullable<typeof world.entities[number]["enemy"]>;
};

type PlayerEntity = typeof world.entities[number] & {
    health: NonNullable<typeof world.entities[number]["health"]>;
    transform: NonNullable<typeof world.entities[number]["transform"]>;
};

export class CombatSystem {
  public update(deltaTime: number) {
    const enemies = world.with("enemy", "combat", "ai", "transform");
    const player = world.with("player", "transform", "health", "input").first;

    if (!player) return;
    
    // --- PLAYER ATTACK LOGIC ---
    if (player.input.isAttacking && player.player.weapon) {
        const weapon = player.player.weapon;
        
        if (!weapon.getIsSwinging()) { 
            // Ideally we get range from weapon or stats
            const range = 3.0; 
            
            weapon.swing(
                range, 
                (mesh: AbstractMesh) => !!(mesh.metadata && mesh.metadata.entityId),
                (targetMesh: AbstractMesh) => {
                     if (targetMesh.metadata?.entityId) {
                         this.dealDamage(targetMesh.metadata.entityId, weapon.attackDamage);
                     }
                }
            );
        }
    }

    // --- ENEMY ATTACK LOGIC ---
    for (const entity of enemies) {
        if (entity.ai.state === "dead") continue;

        // Update Timers
        entity.combat.lastAttackTime += deltaTime;

        // Attack Logic
        if (entity.enemy.isAggro) {
            const playerPos = player.transform.mesh.getAbsolutePosition();
            const enemyPos = entity.transform.mesh.getAbsolutePosition();
            
            // Simple distance check (ignoring height for now)
            const dist = Vector3.Distance(playerPos, enemyPos);

            if (dist <= entity.combat.range) {
                // Check Cooldown
                if (entity.combat.lastAttackTime >= entity.combat.cooldown) {
                    this.performAttack(entity as EnemyEntity, player as PlayerEntity);
                }
            }
        }
    }
  }

  private dealDamage(targetId: string, amount: number) {
      // Find ECS entity by ID
      // Slow linear search again. Ideally we'd have an ID map.
      const targets = world.with("health", "transform"); // Could be enemy OR player technically
      
      for (const t of targets) {
          if (t.transform.mesh.metadata?.entityId === targetId) {
             t.health.current -= amount;
             console.log(`Damage dealt to ${targetId}: ${amount}. Remaining: ${t.health.current}`);
             
             // HealthSystem handles death logic
             return;
          }
      }
  }

  private performAttack(enemy: EnemyEntity, player: PlayerEntity) {
      // 1. Trigger Animation State
      enemy.ai.state = "attack";
      enemy.combat.lastAttackTime = 0;

      // 2. Schedule Damage (Simple delay for now, ideally tied to animation event)
      const damageDelay = enemy.combat.attackDuration * 0.6 * 1000; // 60% through anim
      
      setTimeout(() => {
          // Verify conditions are still met
          if (!enemy.ai || enemy.ai.state === "dead") return;
          if (!player.health || !player.transform) return;
          if (!enemy.transform || !enemy.combat) return;
          
          const dist = Vector3.Distance(
              player.transform.mesh.getAbsolutePosition(), 
              enemy.transform.mesh.getAbsolutePosition()
          );

          if (dist <= enemy.combat.range + 1.0) { // Slight buffer
             player.health.current -= enemy.combat.damage;
             // HealthSystem handles clamping
          }
          
          // Reset state after attack finishes
          if (enemy.ai.state === "attack") {
             enemy.ai.state = "chase"; // Return to chase
          }
      }, damageDelay);
  }
}
