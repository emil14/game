import { world } from "../world";
import { PLAYER_CONFIG, CAMERA_CONFIG } from "../../config";

export class CameraSystem {
  public update(dt: number) {
    // We assume there is only one active player with a camera for now
    const player = world.with("player", "input").first;

    if (!player) return;

    // Zero Tolerance: Camera must exist.
    const camera = player.player.camera!;
    const input = player.input;

    // 1. Crouch Logic
      const isCrouching = input.isCrouching;

      const standEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET;
      // Calculate delta based on config values
      const crouchHeightDelta = CAMERA_CONFIG.STAND_CAMERA_Y - CAMERA_CONFIG.CROUCH_CAMERA_Y;
      const crouchEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET - crouchHeightDelta;
      
      const targetLocalCameraY = isCrouching ? crouchEyePositionRelToParent : standEyePositionRelToParent;
      
      // Lerp camera position
      // Using 10 as lerp speed from original code
      camera.position.y += (targetLocalCameraY - camera.position.y) * Math.min(1, 10 * dt);
  }
}

