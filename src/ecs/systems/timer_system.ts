import { world } from "../world";

export class TimerSystem {
  public update(dt: number) {
    const entities = world.with("timer");

    for (const entity of entities) {
      entity.timer.timeRemaining -= dt;

      if (entity.timer.timeRemaining <= 0) {
        // Execute callback
        if (entity.timer.onComplete) {
            entity.timer.onComplete(entity);
        }
        
        // Remove timer component
        world.removeComponent(entity, "timer");
      }
    }
  }
}

