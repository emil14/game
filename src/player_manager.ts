import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import {
  CAMERA_CONFIG,
  PLAYER_CONFIG,
  KEY_MAPPINGS,
  PHYSICS_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";

export class PlayerManager {
  public camera: FreeCamera;
  public playerLight: PointLight;

  private scene: Scene;
  private inputManager: InputManager;
  private canvas: HTMLCanvasElement;

  public maxHealth: number = PLAYER_CONFIG.MAX_HEALTH;
  public currentHealth: number = PLAYER_CONFIG.MAX_HEALTH;
  public maxStamina: number = PLAYER_CONFIG.MAX_STAMINA;
  public currentStamina: number = PLAYER_CONFIG.MAX_STAMINA;
  public playerIsDead: boolean = false;

  public isCrouching: boolean = false;
  private crouchKeyPressedLastFrame: boolean = false;

  // Will be set from main.ts after physics initialization
  public playerBodyMesh!: Mesh;

  constructor(
    scene: Scene,
    inputManager: InputManager,
    canvas: HTMLCanvasElement
  ) {
    this.scene = scene;
    this.inputManager = inputManager;
    this.canvas = canvas;

    this.camera = new FreeCamera(
      "playerCamera",
      new Vector3(0, CAMERA_CONFIG.STAND_CAMERA_Y, 0), // Initial position will be overridden by parenting to playerBodyMesh
      this.scene
    );
    this.camera.maxZ = CAMERA_CONFIG.MAX_Z;
    this.camera.setTarget(Vector3.Zero()); // Target will be relative to parent
    this.camera.attachControl(this.canvas, true);
    this.camera.inputs.remove(this.camera.inputs.attached.keyboard);
    this.camera.angularSensibility = CAMERA_CONFIG.ANGULAR_SENSIBILITY;
    this.camera.inertia = CAMERA_CONFIG.INERTIA;

    // Player light
    this.playerLight = new PointLight(
      "playerLight",
      new Vector3(0, 0.5, 0),
      this.scene
    );
    this.playerLight.intensity = CAMERA_CONFIG.PLAYER_LIGHT_INTENSITY;
    this.playerLight.range = CAMERA_CONFIG.PLAYER_LIGHT_RANGE;
    this.playerLight.diffuse = new Color3(1, 0.9, 0.7);
    this.playerLight.parent = this.camera; // Light follows the camera
  }

  public initializePhysics(playerBodyMesh: Mesh) {
    this.playerBodyMesh = playerBodyMesh;
    this.camera.parent = this.playerBodyMesh;
    // Adjust camera position relative to the player body mesh (capsule center)
    this.camera.position = new Vector3(
      0,
      PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET,
      0
    );
  }

  public update(deltaTime: number): void {
    if (
      this.playerIsDead &&
      this.inputManager.isKeyPressed(KEY_MAPPINGS.RESPAWN)
    ) {
      this.respawn();
    }

    // Crouching
    const crouchKeyCurrentlyPressed = this.inputManager.isKeyPressed(
      KEY_MAPPINGS.CROUCH
    );
    if (
      crouchKeyCurrentlyPressed &&
      !this.crouchKeyPressedLastFrame &&
      !this.playerIsDead
    ) {
      this.isCrouching = !this.isCrouching;
    }
    this.crouchKeyPressedLastFrame = crouchKeyCurrentlyPressed;

    // We need to adjust the camera's local Y position relative to its parent (playerBodyMesh)
    // The playerBodyMesh's center is at its local origin (0,0,0).
    // The camera needs to be at PLAYER_EYE_HEIGHT_OFFSET when standing,
    // and PLAYER_EYE_HEIGHT_OFFSET - (STAND_CAMERA_Y - CROUCH_CAMERA_Y) when crouching.
    // However, since camera.position.y was initially set to STAND_CAMERA_Y and parented,
    // this becomes more complex.
    // Let's adjust the local Y position directly.
    const crouchLerpSpeed = 10;

    // The actual camera position is relative to playerBodyMesh.
    // STAND_CAMERA_Y and CROUCH_CAMERA_Y were absolute world positions before.
    // Now, they represent offsets from the player's feet if the camera wasn't parented.
    // Since it *is* parented to playerBodyMesh (whose origin is at its center),
    // we need to calculate the target Y relative to the playerBodyMesh origin.
    // PLAYER_EYE_HEIGHT_OFFSET is the standing eye height from the *center* of the capsule.
    const standEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET;
    // The difference in height when crouching
    const crouchHeightDelta =
      CAMERA_CONFIG.STAND_CAMERA_Y - CAMERA_CONFIG.CROUCH_CAMERA_Y;
    const crouchEyePositionRelToParent =
      PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET - crouchHeightDelta;

    const targetLocalCameraY = this.isCrouching
      ? crouchEyePositionRelToParent
      : standEyePositionRelToParent;

    this.camera.position.y +=
      (targetLocalCameraY - this.camera.position.y) *
      Math.min(1, crouchLerpSpeed * deltaTime);

    // Stamina regeneration/depletion will be handled in Iteration 6 (Physics & Movement)
    // Health updates (taking damage) will be handled by external systems (e.g., enemies, environment)
    // and then PlayerManager will be notified.
  }

  public takeDamage(amount: number): void {
    if (this.playerIsDead) return;
    this.currentHealth -= amount;
    if (this.currentHealth < 0) this.currentHealth = 0;
    // HUD blood screen effect will be called from HUDManager when it observes health change or via an event system.
    // For now, we can assume HUDManager might poll this or PlayerManager will call HUDManager.
  }

  public setDead(): void {
    this.playerIsDead = true;
    // Death screen will be called from HUDManager.
  }

  public respawn(): void {
    // For now, a simple page reload. This will be improved later.
    window.location.reload();
  }

  public isPlayerOnGround(): boolean {
    // This check will be moved from main.ts and improved in Iteration 6
    if (
      !this.playerBodyMesh ||
      !this.playerBodyMesh.physicsImpostor ||
      !this.scene
    ) {
      return false;
    }
    // Placeholder - actual ground check needs physics body and raycasting
    // This is a simplified version and will be replaced with a proper raycast in Iteration 6
    const rayOrigin = this.playerBodyMesh.getAbsolutePosition().clone();
    // Ray needs to start from bottom of player model
    rayOrigin.y -= PLAYER_CONFIG.PLAYER_HEIGHT / 2;
    const rayLength = PHYSICS_CONFIG.GROUND_CHECK_DISTANCE + 0.1; // Small epsilon
    const localRay = new Ray(rayOrigin, Vector3.Down(), rayLength);

    const pickInfo = this.scene.pickWithRay(
      localRay,
      (mesh) =>
        mesh !== this.playerBodyMesh &&
        mesh.isPickable &&
        mesh.isEnabled() &&
        !mesh.name.toLowerCase().includes("spider") && // TODO: Make this more generic
        mesh.getTotalVertices() > 0
    );
    return pickInfo?.hit || false;
  }

  // Getters for stats
  public getCurrentHealth(): number {
    return this.currentHealth;
  }
  public getMaxHealth(): number {
    return this.maxHealth;
  }
  public getCurrentStamina(): number {
    return this.currentStamina;
  }
  public getMaxStamina(): number {
    return this.maxStamina;
  }

  // Methods for stamina modification (will be used by movement/actions)
  public depleteStamina(amount: number): void {
    this.currentStamina -= amount;
    if (this.currentStamina < 0) this.currentStamina = 0;
  }

  public regenerateStamina(amount: number): void {
    this.currentStamina += amount;
    if (this.currentStamina > this.maxStamina)
      this.currentStamina = this.maxStamina;
  }
}
