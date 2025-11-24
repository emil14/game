import { world } from "../world";
import { InputManager } from "../../input_manager";
import { KEY_MAPPINGS } from "../../config";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class InputSystem {
  private crouchPressedLastFrame = false;

  constructor(private inputManager: InputManager) {}

  public update() {
    const players = world.with("input", "player");

    for (const entity of players) {
        // Zero Tolerance: We assume the player entity ALWAYS has a camera attached.
        // If not, this will throw, which is preferred over silent failure.
        const camera = entity.player.camera!;

        // --- MOVEMENT MAPPING ---
        const isForward = this.inputManager.isKeyPressed(KEY_MAPPINGS.FORWARD);
        const isBackward = this.inputManager.isKeyPressed(KEY_MAPPINGS.BACKWARD);
        const isLeft = this.inputManager.isKeyPressed(KEY_MAPPINGS.LEFT);
        const isRight = this.inputManager.isKeyPressed(KEY_MAPPINGS.RIGHT);

        const cameraForward = camera.getDirection(Vector3.Forward());
        const cameraRight = camera.getDirection(Vector3.Right());
        cameraForward.y = 0;
        cameraRight.y = 0;
        cameraForward.normalize();
        cameraRight.normalize();

        const moveDir = Vector3.Zero();

        if (isForward) moveDir.addInPlace(cameraForward);
        if (isBackward) moveDir.subtractInPlace(cameraForward);
        if (isRight) moveDir.addInPlace(cameraRight);
        if (isLeft) moveDir.subtractInPlace(cameraRight);

        if (moveDir.lengthSquared() > 0) {
            moveDir.normalize();
        }
        
        // Write to Component
        entity.input.moveDir.copyFrom(moveDir);

        // --- ACTION MAPPING ---
        entity.input.isJumping = this.inputManager.isKeyPressed(KEY_MAPPINGS.JUMP);
        entity.input.isSprinting = this.inputManager.isKeyCodePressed("ShiftLeft");
        entity.input.isAttacking = this.inputManager.isMouseButtonPressed(0);
        
        // --- CROUCH TOGGLE LOGIC ---
        // We handle the toggle logic here so the Component state is "sticky"
        const crouchPressed = this.inputManager.isKeyPressed(KEY_MAPPINGS.CROUCH);
        if (crouchPressed && !this.crouchPressedLastFrame) {
             entity.input.isCrouching = !entity.input.isCrouching;
        }
        this.crouchPressedLastFrame = crouchPressed;
    }
  }
}
