import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Space } from "@babylonjs/core/Maths/math.axis";

/**
 * KinematicControlSystem
 * 
 * Orchestrates the flow:
 * Yuka (Desired Velocity) -> Havok (Physics Body Velocity) -> Babylon (Visual Mesh Transform) -> Yuka (Next Frame Position)
 */
export class KinematicControlSystem {
  public update() {
    const entities = world.with("yuka", "physics", "transform", "visual");

    for (const entity of entities) {
        const vehicle = entity.yuka.vehicle;
        const body = entity.physics.aggregate.body;
        
        // 1. Get Desired Velocity from Yuka (calculated in YukaSystem)
        const desiredVelocity = vehicle.velocity;
        
        // --- VISUAL ROTATION ---
        // Rotate visual mesh to face movement direction
        if (desiredVelocity.squaredLength() > 0.1) {
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
        // Apply Yuka's desired velocity to the Havok body
        // Preserve existing Y velocity (Gravity/Falling) from physics engine
        const currentLinearVel = body.getLinearVelocity();
        
        // TODO: Add check for "Knockback" or "External Force" state here.
        // For now, AI controls horizontal movement 100%
        body.setLinearVelocity(
            new Vector3(desiredVelocity.x, currentLinearVel.y, desiredVelocity.z)
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

        // --- RE-SYNC YUKA ---
        // Crucial: Tell Yuka where the entity ACTUALLY is after Physics simulation.
        // This ensures the next frame of steering calculations starts from the correct world position.
        const physicsPos = entity.transform.mesh.getAbsolutePosition();
        vehicle.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
    }
  }
}

