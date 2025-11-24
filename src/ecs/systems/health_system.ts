import { world } from "../world";

export class HealthSystem {
  public update() {
    // Generic Health Logic for ALL entities (Player + Enemies)
    const entities = world.with("health");
    
    for (const entity of entities) {
        // 1. Clamping
        if (entity.health.current > entity.health.max) {
            entity.health.current = entity.health.max;
        }
        
        // 2. Death Check
        if (entity.health.current <= 0) {
            entity.health.current = 0;
            
            // Handle AI State
            if (entity.ai && entity.ai.state !== "dead") {
                entity.ai.state = "dead";
            }
        }
    }
  }
}
