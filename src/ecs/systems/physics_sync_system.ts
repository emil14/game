import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Space } from "@babylonjs/core/Maths/math.axis";

export class PhysicsSyncSystem {
  public update() {
    const entities = world.with("yuka", "physics", "transform", "visual");

    for (const entity of entities) {
        const vehicle = entity.yuka.vehicle;
        const body = entity.physics.aggregate.body;
        const velocity = vehicle.velocity;
        
        // --- ROTATION (VISUAL ONLY) ---
        // We only rotate the visual mesh, not the physics box (which is rotation-locked)
        if (velocity.squaredLength() > 0.1) {
            const visualMesh = entity.visual.mesh;
            const currentPos = visualMesh.getAbsolutePosition();
            const lookTarget = currentPos.add(new Vector3(velocity.x, 0, velocity.z));
            
            // 1. Look at direction of movement
            visualMesh.lookAt(lookTarget);
            
            // 2. Apply Offset (e.g. 180 flip for GLB) if defined
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

        // --- MOVEMENT (PHYSICS) ---
        // Apply Yuka's desired velocity to the Havok body
        // We preserve Y velocity (Gravity)
        const currentLinearVel = body.getLinearVelocity();
        
        // TODO: Add check for "Knockback" or "External Force" state here
        // If knocked back, we should NOT apply Yuka velocity.
        
        body.setLinearVelocity(
            new Vector3(velocity.x, currentLinearVel.y, velocity.z)
        );

        // --- LOCK PHYSICS ROTATION ---
        // We keep the collider upright (infinite inertia tensor)
        body.setAngularVelocity(Vector3.Zero());
        
        // Ensure Quaternion/Rotation is reset to identity to prevent tipping
        const colliderMesh = entity.transform.mesh;
        if (colliderMesh.rotationQuaternion) {
            colliderMesh.rotationQuaternion.set(0, 0, 0, 1);
        } else {
            colliderMesh.rotation.set(0, 0, 0);
        }

        // --- POSITION SYNC (PHYSICS -> YUKA) ---
        // Havok is the source of truth for position (collisions, gravity)
        // Yuka needs to know where we are to plan the NEXT frame.
        const physicsPos = entity.transform.mesh.getAbsolutePosition();
        vehicle.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
    }
  }
}
