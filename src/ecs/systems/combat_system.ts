import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { PhysicsRegistry } from "../physics_registry";
import { Animation } from "@babylonjs/core/Animations/animation";

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
    const player = world.with("player", "transform", "health", "input", "weapon").first;

    // Zero Tolerance: We expect player to always be present in a running game.
    if (!player) return; 
    
    // Death Check: If player is dead, no attacks allowed (player or enemy on player)
    const isPlayerDead = player.health.current <= 0;

    // --- PLAYER ATTACK LOGIC ---
    if (!isPlayerDead && player.input.isAttacking) {
        const weapon = player.weapon;
        
        // Check cooldown and state
        if (weapon.state === "idle" && (Date.now() - weapon.lastAttackTime > weapon.cooldown * 1000)) { 
            const damageDelaySeconds = 0.15; // 150ms synced
            
            // 1. Set State
            weapon.state = "swinging";
            weapon.lastAttackTime = Date.now();

            // 2. Trigger Visuals (Animation)
            const scene = player.transform.mesh.getScene();
            if (weapon.swingAnimation && weapon.mesh) {
                 scene.beginDirectAnimation(
                    weapon.mesh,
                    [weapon.swingAnimation],
                    0,
                    15, // End frame (hardcoded based on SwordFactory)
                    false,
                    1.0,
                    () => {
                        // Animation ended callback
                        weapon.state = "idle";
                    }
                );
            } else {
                 // Fallback if no animation: reset state after delay
                 setTimeout(() => { weapon.state = "idle"; }, 300);
            }

            // 3. Schedule Damage Logic via ECS Timer
            world.add({
                timer: {
                    timeRemaining: damageDelaySeconds,
                    duration: damageDelaySeconds,
                    label: "player_attack_delay",
                    onComplete: () => {
                        this.performPlayerAttackRaycast(player, weapon.range, weapon.damage);
                    }
                }
            });
        }
    }

    // --- ENEMY ATTACK LOGIC ---
    for (const entity of enemies) {
        if (entity.ai.state === "dead") continue;
        
        // If player is dead, enemies stop aggro/attack
        if (isPlayerDead) {
            entity.ai.state = "idle"; // Or victory?
            continue;
        }

        // Update Timers
        entity.combat.lastAttackTime += deltaTime;

        // Attack Logic
        if (entity.ai.state === "chase" || entity.ai.state === "attack") {
             // Logic handled below, we check range
        }
        
        // We use ai.state as the source of truth for "Aggro" now
        // But we still need to check distance to decide to attack vs chase.
        
        const playerPos = player.transform.mesh.getAbsolutePosition();
        const enemyPos = entity.transform.mesh.getAbsolutePosition();
        
        const dist = Vector3.Distance(playerPos, enemyPos);

        if (dist <= entity.combat.range) {
            // Check Cooldown
            if (entity.combat.lastAttackTime >= entity.combat.cooldown) {
                this.performAttack(entity as EnemyEntity, player as PlayerEntity);
            }
        }
    }
  }

  private performPlayerAttackRaycast(player: PlayerEntity, range: number, damage: number) {
      // Zero Tolerance: Player must have a camera.
      const camera = player.player.camera!; 
      
      const rayOrigin = camera.globalPosition;
      const forwardDirection = camera.getDirection(Vector3.Forward());
      const ray = new Ray(rayOrigin, forwardDirection, range);

      const scene = player.transform.mesh.getScene();

      const pickInfo = scene.pickWithRay(ray, (mesh) => {
          // Check if mesh is registered in PhysicsRegistry (traverse up)
          let current: AbstractMesh | null = mesh;
          while (current) {
              const entity = PhysicsRegistry.getEntityFromMeshId(current.uniqueId);
              if (entity) {
                  // Ignore self (player)
                  if (entity === player) return false;
                  return true;
              }
              current = current.parent as AbstractMesh;
          }
          return false;
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
          // Resolve entity from hit mesh (traverse up)
          let targetEntity = undefined;
          let current: AbstractMesh | null = pickInfo.pickedMesh;
          while (current) {
              targetEntity = PhysicsRegistry.getEntityFromMeshId(current.uniqueId);
              if (targetEntity) break;
              current = current.parent as AbstractMesh;
          }

          if (targetEntity && targetEntity !== player && targetEntity.health) {
             targetEntity.health.current -= damage;
             console.log(`Damage dealt to entity. Remaining: ${targetEntity.health.current}`);
          }
      }
  }

  private performAttack(enemy: EnemyEntity, player: PlayerEntity) {
      // 1. Trigger Animation State
      enemy.ai.state = "attack";
      enemy.combat.lastAttackTime = 0;

      // 2. Schedule Damage via ECS Timer
      const damageDelay = enemy.combat.attackDuration * 0.6; // Seconds
      
      world.add({
          timer: {
              timeRemaining: damageDelay,
              duration: damageDelay,
              label: "enemy_attack_delay",
              onComplete: () => {
                  this.resolveEnemyAttack(enemy, player);
              }
          }
      });
  }

  private resolveEnemyAttack(enemy: EnemyEntity, player: PlayerEntity) {
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
      }
      
      // Reset state after attack finishes
      if (enemy.ai.state === "attack") {
         enemy.ai.state = "chase"; // Return to chase
      }
  }
}
