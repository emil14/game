import { world } from "../world";

export class AnimationSystem {
  public update() {
    const entities = world.with("animations", "yuka", "ai", "physics");

    for (const entity of entities) {
      // FIX: Use PHYSICS velocity, not AI velocity. 
      // If AI wants to move but Physics says "blocked", we should stay in Idle/Push, not Walk.
      const physicsVel = entity.physics.aggregate.body.getLinearVelocity();
      const speed = Math.sqrt(physicsVel.x * physicsVel.x + physicsVel.z * physicsVel.z);
      
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
          
          // Reset to frame 0 for non-looping actions to ensure full playback
          if (!loop) {
              targetAnim.reset();
          }
          
          targetAnim.start(loop, 1.0, targetAnim.from, targetAnim.to, false);
          
          entity.animations.current = targetAnim;
      }
    }
  }
}
