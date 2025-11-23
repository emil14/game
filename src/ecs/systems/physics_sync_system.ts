import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

export class PhysicsSyncSystem {
  public update() {
    const entities = world.with("yuka", "physics", "transform");

    for (const entity of entities) {
        // 1. Apply Yuka Velocity to Havok
        const vehicle = entity.yuka.vehicle;
        const body = entity.physics.aggregate.body;
        
        // Convert Yuka (Vector3) -> Babylon (Vector3)
        // Note: Yuka is Y-up, Babylon is Y-up.
        const velocity = vehicle.velocity;
        
        // Preserve current Y velocity (gravity)
        const currentLinearVel = body.getLinearVelocity();
        
        body.setLinearVelocity(
            new Vector3(velocity.x, currentLinearVel.y, velocity.z)
        );

        // 2. Orientation (Face movement)
        if (velocity.squaredLength() > 0.1) {
            const mesh = entity.transform.mesh as Mesh;
            const currentPos = mesh.getAbsolutePosition();
            const lookTarget = currentPos.add(new Vector3(velocity.x, 0, velocity.z));
            mesh.lookAt(lookTarget);
            
            // Lock Physics Rotation
            body.setAngularVelocity(Vector3.Zero());
            // Force rotation to match mesh (since lookAt updates mesh quaternion)
            if (mesh.rotationQuaternion) {
                body.setRotationQuaternion(mesh.rotationQuaternion);
            }
        }

        // 3. Sync Yuka Position from Physics (Physics is Authority)
        const physicsPos = entity.transform.mesh.getAbsolutePosition();
        vehicle.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
    }
  }
}

