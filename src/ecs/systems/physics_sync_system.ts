import { world } from "../world";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

export class PhysicsSyncSystem {
  public update() {
    const entities = world.with("yuka", "physics", "transform", "visual");

    for (const entity of entities) {
        const vehicle = entity.yuka.vehicle;
        const body = entity.physics.aggregate.body;
        const velocity = vehicle.velocity;
        
        // ROTATION
        if (velocity.squaredLength() > 0.1) {
            const visualMesh = entity.visual.mesh;
            const currentPos = visualMesh.getAbsolutePosition();
            const lookTarget = currentPos.add(new Vector3(velocity.x, 0, velocity.z));
            visualMesh.lookAt(lookTarget);
            
            // Fix Backward Movement: If the model faces -Z (common in GLB), lookAt makes it walk backward.
            // Rotate 180 degrees (PI) around Y axis to correct.
            visualMesh.rotate(new Vector3(0, 1, 0), Math.PI);
        }

        // MOVEMENT
        const currentLinearVel = body.getLinearVelocity();
        body.setLinearVelocity(
            new Vector3(velocity.x, currentLinearVel.y, velocity.z)
        );

        // LOCK PHYSICS ROTATION
        body.setAngularVelocity(Vector3.Zero());
        const colliderMesh = entity.transform.mesh;
        if (colliderMesh.rotationQuaternion) {
            colliderMesh.rotationQuaternion.set(0, 0, 0, 1);
        } else {
            colliderMesh.rotation.set(0, 0, 0);
        }

        // POSITION SYNC
        const physicsPos = entity.transform.mesh.getAbsolutePosition();
        vehicle.position.set(physicsPos.x, physicsPos.y, physicsPos.z);
    }
  }
}
