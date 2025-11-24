import { world } from "../world";
import { PlayerManager } from "../../player_manager";
import { PLAYER_CONFIG } from "../../config";

export class PlayerControlSystem {
  constructor(private playerManager: PlayerManager) {}

  public update(dt: number) {
    const players = world.with("input", "player", "stamina");

    for (const entity of players) {
        // We still access playerManager.characterController because that class instance 
        // wraps the Babylon Mesh and Physics. Ideally, the CharacterController instance 
        // should be on the Entity (in a component), not on the Manager.
        // For this step, we proxy through the manager or entity if we added it?
        
        // Entity Definition says: player?: PlayerComponent { controller?: CharacterController }
        // Let's use THAT if available, otherwise fallback.
        
        let controller = entity.player.controller;
        
        // Fallback to manager's controller if not on entity yet (Migration safety)
        if (!controller) {
            // We can't easily access private property of Manager unless we expose it 
            // or if we rely on the Entity having it.
            // Let's assume for this step we MUST have it on the entity.
            // In Game.ts or PlayerManager.init, we should ensure it's attached.
            continue; 
        }

        // --- APPLY INPUT TO CONTROLLER ---
        controller.setMoveDirection(entity.input.moveDir);
        controller.run(entity.input.isSprinting);

        // Crouch Speed Mod
        if (entity.input.isCrouching) {
             controller.setWalkSpeed(PLAYER_CONFIG.DEFAULT_SPEED * PLAYER_CONFIG.CROUCH_SPEED_MULTIPLIER);
        } else {
             controller.setWalkSpeed(PLAYER_CONFIG.DEFAULT_SPEED);
        }

        // Jump
        // We need state tracking for "Jump Pressed Last Frame" to avoid spam-jumping 
        // if the system runs faster than input releases? 
        // InputSystem handles "isJumping" as "Is Key Pressed".
        // CharacterController.jump() checks isGrounded internally.
        // But we need to dedup the stamina cost application.
        
        // ISSUE: If I hold space, Input is true.
        // Frame 1: Jump() -> Velocity Y. Stamina Deduct.
        // Frame 2: In Air. Jump() -> Ignored by CC. Stamina Deduct? -> BUG.
        
        // Fix: We need "JustPressed" logic or check grounded state before deducting cost.
        if (entity.input.isJumping) {
             // Only attempt jump if grounded (to prevent stamina drain in air)
             if (controller.isGrounded() && entity.stamina.current >= PLAYER_CONFIG.JUMP_STAMINA_COST) {
                 controller.jump();
                 // Deduct Stamina
                 entity.stamina.current -= PLAYER_CONFIG.JUMP_STAMINA_COST;
                 if (entity.stamina.current < 0) entity.stamina.current = 0;
             }
        }

        // --- STAMINA LOGIC (Sprint Depletion / Regen) ---
        const isMoving = entity.input.moveDir.lengthSquared() > 0;
        
        if (entity.input.isSprinting && isMoving) {
             if (entity.stamina.current > 0) {
                  entity.stamina.current -= PLAYER_CONFIG.STAMINA_DEPLETION_RATE * dt;
                  if (entity.stamina.current < 0) {
                      entity.stamina.current = 0;
                      controller.run(false); // Force stop running
                  }
             }
        } else {
             // Regen
             if (entity.stamina.current < entity.stamina.max) {
                 let regen = PLAYER_CONFIG.STAMINA_REGENERATION_RATE;
                 if (isMoving) regen = 0; // No regen while walking (optional design choice, matches previous)
                 
                 entity.stamina.current += regen * dt;
                 if (entity.stamina.current > entity.stamina.max) entity.stamina.current = entity.stamina.max;
             }
        }
    }
  }
}

