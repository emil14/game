import { world } from "../world";
import { InputManager } from "../../input_manager";
import { KEY_MAPPINGS } from "../../config";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Camera } from "@babylonjs/core/Cameras/camera";

export class InputSystem {
  constructor(private inputManager: InputManager, private camera: Camera) {}

  public update() {
    // 1. Fetch the player entity that has Input
    // Ideally this component is on the player
    const players = world.with("input");

    for (const entity of players) {
        // --- MOVEMENT MAPPING ---
        const isForward = this.inputManager.isKeyPressed(KEY_MAPPINGS.FORWARD);
        const isBackward = this.inputManager.isKeyPressed(KEY_MAPPINGS.BACKWARD);
        const isLeft = this.inputManager.isKeyPressed(KEY_MAPPINGS.LEFT);
        const isRight = this.inputManager.isKeyPressed(KEY_MAPPINGS.RIGHT);

        const cameraForward = this.camera.getDirection(Vector3.Forward());
        const cameraRight = this.camera.getDirection(Vector3.Right());
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
        // Jump: Pulse check handled by Physics/CharacterController, 
        // but here we register the *intent*.
        // Note: For now we just map the boolean state.
        entity.input.isJumping = this.inputManager.isKeyPressed(KEY_MAPPINGS.JUMP);
        entity.input.isSprinting = this.inputManager.isKeyCodePressed("ShiftLeft");
        
        // Toggle Crouch Logic (Basic implementation: toggle on press)
        // Ideally this logic of "toggle" lives in a State System, but for raw input mapping:
        // We will just map the KEY STATE here. The consumer decides if it's toggle or hold.
        // But PlayerManager used Toggle. Let's support Hold for "isCrouching" intent in ECS for simplicity first?
        // Actually, let's map the RAW intent. 
        entity.input.isCrouching = this.inputManager.isKeyPressed(KEY_MAPPINGS.CROUCH);

        entity.input.isAttacking = this.inputManager.isMouseButtonPressed(0);
    }
  }
}

