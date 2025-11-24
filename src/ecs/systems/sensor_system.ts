import { world } from "../world";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsRegistry } from "../physics_registry";

export class SensorSystem {
  public update() {
    // Assume sensor is on the player for now (or anything with a Camera + Sensor)
    // In future, could be just Transform + Sensor (enemies sensing player)
    const sensors = world.with("sensor", "player", "transform");

    for (const entity of sensors) {
        const camera = entity.player.camera;
        if (!camera) continue;

        const origin = camera.globalPosition;
        const direction = camera.getDirection(Vector3.Forward());
        const length = entity.sensor.checkRange;
        
        const ray = new Ray(origin, direction, length);
        const scene = entity.transform.mesh.getScene();

        // Reset Sensor State
        entity.sensor.hitEntity = undefined;
        entity.sensor.hitDistance = Infinity;
        entity.sensor.hitPoint = undefined;
        entity.sensor.hitMetadata = undefined;

        const pickInfo = scene.pickWithRay(ray, (mesh) => {
            // Filter: Must be in Registry OR be interactable type
            // Check up the hierarchy for a registered entity
            let currentMesh: AbstractMesh | null = mesh;
            while (currentMesh) {
                const foundEntity = PhysicsRegistry.getEntityFromMeshId(currentMesh.uniqueId);
                if (foundEntity) {
                    // Ignore self (the sensor owner)
                    if (foundEntity === entity) return false;
                    return true;
                }
                
                if (currentMesh.metadata && currentMesh.metadata.interactableType) {
                    return true;
                }
                
                currentMesh = currentMesh.parent as AbstractMesh;
            }
            return false;
        });

        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
             entity.sensor.hitDistance = pickInfo.distance;
             entity.sensor.hitPoint = pickInfo.pickedPoint || undefined;

             // 1. Registry Check (Traverse up)
             let hitEntity = undefined;
             let currentMesh: AbstractMesh | null = pickInfo.pickedMesh;
             
             while (currentMesh) {
                 hitEntity = PhysicsRegistry.getEntityFromMeshId(currentMesh.uniqueId);
                 if (hitEntity) break;
                 currentMesh = currentMesh.parent as AbstractMesh;
             }
             
             if (hitEntity) {
                 entity.sensor.hitEntity = hitEntity;
             }

             // 2. Metadata Check (Traverse up)
             // Find the first metadata in the hierarchy that might be relevant
             currentMesh = pickInfo.pickedMesh;
             while (currentMesh) {
                 if (currentMesh.metadata) {
                     entity.sensor.hitMetadata = currentMesh.metadata;
                     break;
                 }
                 currentMesh = currentMesh.parent as AbstractMesh;
             }
        }
    }
  }
}

