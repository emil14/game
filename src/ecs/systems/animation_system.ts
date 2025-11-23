import { world } from "../world";

export class AnimationSystem {
  public update() {
    const entities = world.with("animations", "yuka", "ai");

    for (const entity of entities) {
      const velocity = entity.yuka.vehicle.velocity;
      const speed = velocity.squaredLength();
      
      let targetAnim = entity.animations.idle;

      if (entity.ai.state === "dead") {
          targetAnim = entity.animations.death;
      } else if (entity.ai.state === "attack") {
          targetAnim = entity.animations.attack;
      } else if (speed > 0.1) {
          targetAnim = entity.animations.walk;
      }

      // Transition
      if (targetAnim && targetAnim !== entity.animations.current) {
          // Stop current
          if (entity.animations.current) {
             entity.animations.current.stop();
          }
          
          // Play new
          // Handle non-looping death/attack
          const loop = (entity.ai.state !== "dead" && entity.ai.state !== "attack");
          targetAnim.start(loop, 1.0, targetAnim.from, targetAnim.to, false);
          
          entity.animations.current = targetAnim;
      }
    }
  }
}

