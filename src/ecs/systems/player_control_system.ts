import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Scene } from "@babylonjs/core/scene";
import { PLAYER_CONFIG } from "../../config";

export class PlayerControlSystem {
  constructor(private scene: Scene) {}

  public update(dt: number) {
    const players = world.with("input", "player", "stamina", "physics", "transform", "health");

    for (const entity of players) {
        // Death Check
        if (entity.health.current <= 0) {
            // Ensure no lingering velocity from inputs (optional: apply friction/drag)
            // But let physics/gravity continue.
            return;
        }

        const body = entity.physics.aggregate.body;
        const input = entity.input;

        // 1. Ground Check
        const rayOrigin = entity.transform.mesh.position.clone();
        // Adjust ray length based on player height. 
        // Pivot is center, so check from center down.
        // Height = 2 (approx), so 1.0 down is feet. Add 0.1 buffer.
        const rayLength = (PLAYER_CONFIG.PLAYER_HEIGHT / 2) + 0.1;
        
        const ray = new Ray(rayOrigin, Vector3.Down(), rayLength);
        
        // Pick with filter: check collisions enabled, ignore self
        const pick = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.checkCollisions && mesh !== entity.transform.mesh;
        });
        const isGrounded = pick?.hit || false;

        // 2. Calculate Target Velocity
        let speed = PLAYER_CONFIG.DEFAULT_SPEED;
        if (input.isSprinting) speed *= PLAYER_CONFIG.RUN_SPEED_MULTIPLIER;
        if (input.isCrouching) speed *= PLAYER_CONFIG.CROUCH_SPEED_MULTIPLIER;

        // Input moveDir is normalized world direction
        const targetVelX = input.moveDir.x * speed;
        const targetVelZ = input.moveDir.z * speed;

        // 3. Apply Velocity
        const currentVel = body.getLinearVelocity();
        
        // Preserve Y velocity (Gravity), Override X/Z
        // Note: Ideally we lerp to target velocity for momentum, but direct set is snappier for FPS
        body.setLinearVelocity(new Vector3(targetVelX, currentVel.y, targetVelZ));

        // 4. Jump Logic
        if (input.isJumping && isGrounded) {
             if (entity.stamina.current >= PLAYER_CONFIG.JUMP_STAMINA_COST) {
                 // Apply precise jump velocity
                 const jumpVel = new Vector3(currentVel.x, PLAYER_CONFIG.JUMP_FORCE, currentVel.z);
                 body.setLinearVelocity(jumpVel);
                 
                 entity.stamina.current -= PLAYER_CONFIG.JUMP_STAMINA_COST;
                 if (entity.stamina.current < 0) entity.stamina.current = 0;
             }
        }

        // 5. Stamina Regen / Depletion (Simplified)
        const isMoving = input.moveDir.lengthSquared() > 0;
        
        if (input.isSprinting && isMoving) {
             if (entity.stamina.current > 0) {
                  entity.stamina.current -= PLAYER_CONFIG.STAMINA_DEPLETION_RATE * dt;
                  if (entity.stamina.current < 0) entity.stamina.current = 0;
             }
        } else {
             if (entity.stamina.current < entity.stamina.max) {
                 // No regen while moving? Matching old logic
                 const regen = isMoving ? 0 : PLAYER_CONFIG.STAMINA_REGENERATION_RATE;
                 entity.stamina.current += regen * dt;
                 if (entity.stamina.current > entity.stamina.max) entity.stamina.current = entity.stamina.max;
             }
        }
    }
  }
}
