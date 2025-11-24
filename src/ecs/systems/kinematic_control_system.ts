import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Space } from "@babylonjs/core/Maths/math.axis";

/**
 * KinematicControlSystem
 * 
 * Orchestrates the flow:
 * MovementComponent (Desired Velocity) -> Havok (Physics Body Velocity) -> Babylon (Visual Mesh Transform)
 * 
 * Note: Yuka sync and Input processing happen in their respective systems, 
 * writing to MovementComponent.
 */
export class KinematicControlSystem {
  public update() {
    // Unified Physics Application: Handle both Player and AI entities
    const entities = world.with("movement", "physics", "transform");

    for (const entity of entities) {
        const body = entity.physics.aggregate.body;
        const movement = entity.movement;
        
        // 1. Get Desired Velocity (X/Z)
        const desiredVelocity = movement.velocity;
        
        // --- VISUAL ROTATION ---
        // Rotate visual mesh to face movement direction
        if (entity.visual && desiredVelocity.lengthSquared() > 0.1) {
            const visualMesh = entity.visual.mesh;
            const currentPos = visualMesh.getAbsolutePosition();
            const lookTarget = currentPos.add(new Vector3(desiredVelocity.x, 0, desiredVelocity.z));
            
            visualMesh.lookAt(lookTarget);
            
            // Apply Offset (e.g. 180 flip for GLB) if defined
            if (entity.visual.rotationOffset) {
                visualMesh.rotate(
                    new Vector3(1, 0, 0), entity.visual.rotationOffset.x, Space.LOCAL
                );
                visualMesh.rotate(
                    new Vector3(0, 1, 0), entity.visual.rotationOffset.y, Space.LOCAL
                );
                visualMesh.rotate(
                    new Vector3(0, 0, 1), entity.visual.rotationOffset.z, Space.LOCAL
                );
            }
        }

        // --- PHYSICS APPLICATION ---
        // Apply desired velocity to the Havok body
        const currentLinearVel = body.getLinearVelocity();
        
        // Default: Preserve existing Y velocity (Gravity/Falling)
        let targetY = currentLinearVel.y;
        
        // Handle One-Shot Jump Impulse
        if (movement.jumpVelocity !== undefined) {
             targetY = movement.jumpVelocity;
             movement.jumpVelocity = undefined; // Consume the impulse immediately
        }
        
        body.setLinearVelocity(
            new Vector3(desiredVelocity.x, targetY, desiredVelocity.z)
        );

        // Lock Physics Rotation (keep upright)
        body.setAngularVelocity(Vector3.Zero());
        
        // Reset Collider Rotation to identity to prevent tipping
        const colliderMesh = entity.transform.mesh;
        if (colliderMesh.rotationQuaternion) {
            colliderMesh.rotationQuaternion.set(0, 0, 0, 1);
        } else {
            colliderMesh.rotation.set(0, 0, 0);
        }
    }
  }
}
