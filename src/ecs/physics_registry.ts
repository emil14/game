// src/ecs/physics_registry.ts
import { PhysicsAggregate } from "@babylonjs/core/Physics";
import { Entity } from "./world";

export class PhysicsRegistry {
    private static bodyToEntity = new Map<number, Entity>();

    public static register(aggregate: PhysicsAggregate, entity: Entity) {
        // Havok Body IDs are available on the body object.
        // Babylon wrappers expose it via body.uniqueId usually, or we track the mesh uniqueId.
        // For HavokPlugin, the 'body' object is the Babylon wrapper PhysicsBody.
        // Its uniqueId is what pickWithRay returns for physics picking usually.
        // But for standard Picking, we get the Mesh.
        
        // We will map the MESH uniqueId to the Entity, because Raycast returns Mesh.
        if (entity.transform && entity.transform.mesh) {
            PhysicsRegistry.bodyToEntity.set(entity.transform.mesh.uniqueId, entity);
        }
    }

    public static getEntityFromMeshId(meshId: number): Entity | undefined {
        return PhysicsRegistry.bodyToEntity.get(meshId);
    }
    
    public static remove(entity: Entity) {
        if (entity.transform && entity.transform.mesh) {
            PhysicsRegistry.bodyToEntity.delete(entity.transform.mesh.uniqueId);
        }
    }
}

