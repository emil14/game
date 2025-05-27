import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { PhysicsAggregate } from "@babylonjs/core/Physics";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import {
  CAMERA_CONFIG,
  PLAYER_CONFIG,
  KEY_MAPPINGS,
  PHYSICS_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";
import { Sword } from "./weapons/sword";
import { Spider } from "./enemies/spider";
import { HUDManager } from "./hud_manager";

export class PlayerManager {
  public camera: FreeCamera;
  public playerLight: PointLight;
  public playerSword!: Sword;

  private scene: Scene;
  private inputManager: InputManager;
  private hudManager: HUDManager;
  private canvas: HTMLCanvasElement;

  public maxHealth: number = PLAYER_CONFIG.MAX_HEALTH;
  public currentHealth: number = PLAYER_CONFIG.MAX_HEALTH;
  public maxStamina: number = PLAYER_CONFIG.MAX_STAMINA;
  public currentStamina: number = PLAYER_CONFIG.MAX_STAMINA;
  public playerIsDead: boolean = false;

  public isCrouching: boolean = false;
  private crouchKeyPressedLastFrame: boolean = false;

  // Physics & Movement
  public playerBodyMesh!: Mesh;
  public playerBodyAggregate!: PhysicsAggregate;

  // Movement state
  private isMovingForward: boolean = false;
  private isMovingBackward: boolean = false;
  private isMovingLeft: boolean = false;
  private isMovingRight: boolean = false;
  private isSprinting: boolean = false;
  private jumpKeyPressedLastFrame: boolean = false;

  constructor(
    scene: Scene,
    inputManager: InputManager,
    hudManager: HUDManager,
    canvas: HTMLCanvasElement
  ) {
    this.scene = scene;
    this.inputManager = inputManager;
    this.hudManager = hudManager;
    this.canvas = canvas;

    this.camera = new FreeCamera(
      "playerCamera",
      new Vector3(0, CAMERA_CONFIG.STAND_CAMERA_Y, -5),
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

  public initializePhysics(
    playerBodyMesh: Mesh,
    playerBodyAggregate: PhysicsAggregate
  ) {
    this.playerBodyMesh = playerBodyMesh;
    this.playerBodyAggregate = playerBodyAggregate;
    this.camera.parent = this.playerBodyMesh;
    // Adjust camera position relative to the player body mesh (capsule center)
    this.camera.position = new Vector3(
      0,
      PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET,
      0
    );
  }

  public async initializeSword() {
    this.playerSword = await Sword.Create(
      this.scene,
      this.camera,
      PLAYER_CONFIG.SWORD_DAMAGE
    );
  }

  public update(deltaTime: number): void {
    // Handle respawn
    if (
      this.playerIsDead &&
      this.inputManager.isKeyPressed(KEY_MAPPINGS.RESPAWN)
    ) {
      this.respawn();
    }

    // Handle sword attack input
    if (
      this.inputManager.isMouseButtonPressed(0) &&
      this.playerSword &&
      !this.playerIsDead &&
      !this.playerSword.getIsSwinging()
    ) {
      this.playerSword.swing(
        PLAYER_CONFIG.SWORD_ATTACK_DISTANCE,
        (mesh: AbstractMesh) =>
          mesh.metadata && mesh.metadata.enemyType === "spider",
        (_targetMesh: AbstractMesh, instance: Spider) => {
          const spiderInstance = instance as Spider;
          if (
            spiderInstance &&
            spiderInstance.currentHealth > 0 &&
            this.playerSword
          ) {
            spiderInstance.takeDamage(this.playerSword.attackDamage);
          }
        }
      );
    }

    // Update movement input states
    this.isMovingForward = this.inputManager.isKeyPressed(KEY_MAPPINGS.FORWARD);
    this.isMovingBackward = this.inputManager.isKeyPressed(
      KEY_MAPPINGS.BACKWARD
    );
    this.isMovingLeft = this.inputManager.isKeyPressed(KEY_MAPPINGS.LEFT);
    this.isMovingRight = this.inputManager.isKeyPressed(KEY_MAPPINGS.RIGHT);

    // Handle sprinting
    const shiftPressed = this.inputManager.isKeyCodePressed("ShiftLeft");
    if (shiftPressed && this.currentStamina > 0 && !this.playerIsDead) {
      this.isSprinting = true;
    } else {
      this.isSprinting = false;
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

    // Update camera position for crouch
    const crouchLerpSpeed = 10;
    const standEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET;
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

    // Handle physics movement
    if (
      !this.playerIsDead &&
      this.playerBodyAggregate &&
      this.playerBodyAggregate.body
    ) {
      const currentPhysicsVelocity =
        this.playerBodyAggregate.body.getLinearVelocity();
      let finalVelocity = new Vector3(0, currentPhysicsVelocity.y, 0);

      // Calculate movement direction
      let targetVelocityXZ = Vector3.Zero();
      const forward = this.camera.getDirection(Vector3.Forward());
      const right = this.camera.getDirection(Vector3.Right());
      forward.y = 0;
      right.y = 0;
      forward.normalize();
      right.normalize();

      if (this.isMovingForward) targetVelocityXZ.addInPlace(forward);
      if (this.isMovingBackward) targetVelocityXZ.subtractInPlace(forward);
      if (this.isMovingLeft) targetVelocityXZ.subtractInPlace(right);
      if (this.isMovingRight) targetVelocityXZ.addInPlace(right);

      // Apply speed modifiers
      let actualSpeed = PLAYER_CONFIG.DEFAULT_SPEED;
      if (this.isSprinting) {
        actualSpeed *= PLAYER_CONFIG.RUN_SPEED_MULTIPLIER;
      }
      if (this.isCrouching) {
        actualSpeed *= PLAYER_CONFIG.CROUCH_SPEED_MULTIPLIER;
      }

      // --- Direction-based speed multiplier ---
      let directionMultiplier = 1.0;
      const movingForward = this.isMovingForward && !this.isMovingBackward;
      const movingBackward = this.isMovingBackward && !this.isMovingForward;
      const movingSide =
        (this.isMovingLeft || this.isMovingRight) &&
        !this.isMovingForward &&
        !this.isMovingBackward;
      // Diagonal: forward+side = forward dominates, back+side = backward dominates
      if (movingForward) {
        directionMultiplier = 1.0;
      } else if (movingBackward) {
        directionMultiplier = 0.5;
      } else if (movingSide) {
        directionMultiplier = 0.75;
      }
      // If moving diagonally (forward+side), forward dominates (already handled by movingForward)
      // If moving diagonally (back+side), backward dominates (already handled by movingBackward)
      actualSpeed *= directionMultiplier;
      // --- End direction-based speed multiplier ---

      // --- Camera FOV based on sprinting ---
      this.camera.fov = CAMERA_CONFIG.BASE_FOV;
      // --- End Camera FOV ---

      // Apply movement
      if (targetVelocityXZ.lengthSquared() > 0.001) {
        targetVelocityXZ.normalize().scaleInPlace(actualSpeed);
        finalVelocity.x = targetVelocityXZ.x;
        finalVelocity.z = targetVelocityXZ.z;
      } else {
        finalVelocity.x = 0;
        finalVelocity.z = 0;
      }

      // Handle jumping
      const jumpKeyCurrentlyPressed = this.inputManager.isKeyPressed(
        KEY_MAPPINGS.JUMP
      );
      if (
        jumpKeyCurrentlyPressed &&
        !this.jumpKeyPressedLastFrame &&
        !this.playerIsDead
      ) {
        const isOnGround = this.isPlayerOnGround();
        if (
          this.currentStamina >= PLAYER_CONFIG.JUMP_STAMINA_COST &&
          isOnGround
        ) {
          finalVelocity.y = PLAYER_CONFIG.JUMP_FORCE;
          this.depleteStamina(PLAYER_CONFIG.JUMP_STAMINA_COST);
        }
      }
      this.jumpKeyPressedLastFrame = jumpKeyCurrentlyPressed;

      // Apply final velocity
      this.playerBodyAggregate.body.setLinearVelocity(finalVelocity);

      // Handle stamina depletion/regeneration
      if (this.isSprinting && targetVelocityXZ.lengthSquared() > 0.001) {
        if (this.currentStamina > 0) {
          this.depleteStamina(PLAYER_CONFIG.STAMINA_DEPLETION_RATE * deltaTime);
        }
        if (this.currentStamina <= 0) {
          this.currentStamina = 0;
          this.isSprinting = false;
        }
      } else {
        if (this.currentStamina < this.maxStamina) {
          let currentRegenRate = PLAYER_CONFIG.STAMINA_REGENERATION_RATE;
          // No regen while moving (but not sprinting)
          if (
            !this.isSprinting &&
            (this.isMovingForward ||
              this.isMovingBackward ||
              this.isMovingLeft ||
              this.isMovingRight)
          ) {
            currentRegenRate = 0;
          }
          if (currentRegenRate > 0) {
            this.regenerateStamina(currentRegenRate * deltaTime);
          }
        }
      }
    } else if (
      this.playerIsDead &&
      this.playerBodyAggregate &&
      this.playerBodyAggregate.body
    ) {
      // Stop all movement when dead
      this.playerBodyAggregate.body.setLinearVelocity(Vector3.Zero());
    }

    // Handle player death
    if (this.currentHealth <= 0 && !this.playerIsDead) {
      this.setDead();
      // Note: Fight music pause is handled in main.ts based on isInFightMode
    }
  }

  public takeDamage(amount: number): void {
    if (this.playerIsDead) return;
    this.currentHealth -= amount;
    if (this.currentHealth < 0) this.currentHealth = 0;
    this.hudManager.showBloodScreenEffect(); // Notify HUDManager
  }

  public setDead(): void {
    this.playerIsDead = true;
    this.hudManager.showDeathScreen(); // Notify HUDManager
    console.log("Player has died.");
    // Potentially stop fight music here or emit an event
  }

  public respawn(): void {
    // For now, a simple page reload. This will be improved later.
    window.location.reload();
  }

  public isPlayerOnGround(): boolean {
    if (
      !this.playerBodyMesh ||
      !this.playerBodyAggregate ||
      !this.playerBodyAggregate.body ||
      !this.scene
    ) {
      return false;
    }

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
