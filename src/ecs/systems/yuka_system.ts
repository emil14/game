import { world, getPosition } from "../world";
import { AIManager } from "../../ai/ai_manager";

export class YukaSystem {
    constructor(private aiManager: AIManager) {}

    public update() {
        // 1. Sync Physics Position -> Yuka Vehicle (Pre-Update)
        // This ensures Yuka plans from where the entity actually IS.
        const aiEntities = world.with("yuka", "transform");
        for (const entity of aiEntities) {
             const pos = getPosition(entity);
             entity.yuka.vehicle.position.set(pos.x, pos.y, pos.z);
        }

        // 2. Advance Yuka Simulation (Calculates steering forces & new velocity)
        this.aiManager.update();

        // 3. Output Yuka Velocity -> Movement Component
        // This decouples AI calculation from Physics application.
        const movingEntities = world.with("yuka", "movement");
        for (const entity of movingEntities) {
             const vel = entity.yuka.vehicle.velocity;
             // We map Yuka's 3D velocity to our Movement Component
             // Usually AI stays on ground, but if Yuka has Y velocity we might want it?
             // For now, let's assume ground movement (X/Z) + Gravity handled by Havok.
             entity.movement.velocity.set(vel.x, 0, vel.z);
        }
    }
}
