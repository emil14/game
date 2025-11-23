import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CharacterController } from "./lib/character_controller";

import {
  CAMERA_CONFIG,
  PLAYER_CONFIG,
  KEY_MAPPINGS,
  PHYSICS_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";
import { IWeapon } from "./weapons/iweapon";
import { IEnemy } from "./enemies/ienemy";
import { HUDManager } from "./hud_manager";
import { Sword } from "./weapons/sword";
import { world } from "./ecs/world";

export class PlayerManager {
  public camera: UniversalCamera;
  public playerLight: PointLight;
  public playerSword!: IWeapon;

  private scene: Scene;
  private inputManager: InputManager;
  private hudManager: HUDManager;
  private canvas: HTMLCanvasElement;

  public playerIsDead: boolean = false;

  public isCrouching: boolean = false;
  private crouchKeyPressedLastFrame: boolean = false;

  // Physics & Movement
  public playerBodyMesh!: Mesh;
  private characterController!: CharacterController;

  // Movement state
  private isMovingForward: boolean = false;
  private isMovingBackward: boolean = false;
  private isMovingLeft: boolean = false;
  private isMovingRight: boolean = false;
  private isSprinting: boolean = false;
  private jumpKeyPressedLastFrame: boolean = false;

  public godmode: boolean = false;

  // ECS Query
  private playerQuery = world.with("player", "health", "stamina");

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

    this.camera = new UniversalCamera(
      "playerCamera",
      new Vector3(0, CAMERA_CONFIG.STAND_CAMERA_Y, -5),
      this.scene
    );
    this.camera.maxZ = CAMERA_CONFIG.MAX_Z;
    this.camera.setTarget(Vector3.Zero()); 
    this.camera.attachControl(this.canvas, true);
    this.camera.inputs.remove(this.camera.inputs.attached.keyboard); // We handle movement
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

  private get playerEntity() {
    return this.playerQuery.first;
  }

  public initializeCharacterController(playerBodyMesh: Mesh) {
    this.playerBodyMesh = playerBodyMesh;
    this.camera.parent = this.playerBodyMesh;
    // Adjust camera position relative to the player body mesh (capsule center)
    this.camera.position = new Vector3(
      0,
      PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET,
      0
    );
    
    this.characterController = new CharacterController(
      this.playerBodyMesh,
      this.camera,
      this.scene
    );
    
    // We'll drive it via update()
    this.characterController.enableKeyBoard(false);
    
    // Sync config
    this.characterController.setJumpSpeed(PLAYER_CONFIG.JUMP_FORCE); 
    this.characterController.setWalkSpeed(PLAYER_CONFIG.DEFAULT_SPEED);
    this.characterController.setRunSpeed(PLAYER_CONFIG.DEFAULT_SPEED * PLAYER_CONFIG.RUN_SPEED_MULTIPLIER);
  }

  public async initializeSword() {
    this.playerSword = await Sword.Create(
      this.scene,
      this.camera,
      PLAYER_CONFIG.SWORD_DAMAGE
    );
  }

  public update(deltaTime: number): void {
    const player = this.playerEntity;
    if (!player) return; // Wait for ECS initialization

    // Handle respawn
    if (
      this.playerIsDead &&
      this.inputManager.isKeyPressed(KEY_MAPPINGS.RESPAWN)
    ) {
      this.respawn();
    }

    // GODMODE: Always max health/stamina if enabled
    if (this.godmode) {
      player.health.current = player.health.max;
      player.stamina.current = player.stamina.max;
      this.playerIsDead = false;
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
        (_targetMesh: AbstractMesh, instance: IEnemy) => {
          const enemyInstance = instance as IEnemy;
          if (
            enemyInstance &&
            enemyInstance.currentHealth > 0 &&
            this.playerSword
          ) {
            enemyInstance.takeDamage(this.playerSword.attackDamage);
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
    if (shiftPressed && player.stamina.current > 0 && !this.playerIsDead) {
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
    if (!this.playerIsDead && this.characterController) {
      this.characterController.walk(this.isMovingForward);
      this.characterController.walkBack(this.isMovingBackward);
      this.characterController.strafeLeft(this.isMovingLeft);
      this.characterController.strafeRight(this.isMovingRight);
      // Crouching logic - speed modification
      if (this.isCrouching) {
          this.characterController.setWalkSpeed(PLAYER_CONFIG.DEFAULT_SPEED * PLAYER_CONFIG.CROUCH_SPEED_MULTIPLIER);
      } else {
          this.characterController.setWalkSpeed(PLAYER_CONFIG.DEFAULT_SPEED);
      }
      this.characterController.run(this.isSprinting);

      // Handle jumping
      const jumpKeyCurrentlyPressed = this.inputManager.isKeyPressed(
        KEY_MAPPINGS.JUMP
      );
      if (
        jumpKeyCurrentlyPressed &&
        !this.jumpKeyPressedLastFrame
      ) {
        if (player.stamina.current >= PLAYER_CONFIG.JUMP_STAMINA_COST) {
             this.characterController.jump();
             this.depleteStamina(PLAYER_CONFIG.JUMP_STAMINA_COST);
        }
      }
      this.jumpKeyPressedLastFrame = jumpKeyCurrentlyPressed;

      // Stamina depletion for running
      if (this.isSprinting && (this.isMovingForward || this.isMovingBackward || this.isMovingLeft || this.isMovingRight)) {
        if (player.stamina.current > 0) {
          this.depleteStamina(PLAYER_CONFIG.STAMINA_DEPLETION_RATE * deltaTime);
        }
        if (player.stamina.current <= 0) {
          player.stamina.current = 0;
          this.isSprinting = false;
          this.characterController.run(false);
        }
      } else {
        if (player.stamina.current < player.stamina.max) {
           // Regen logic
          let currentRegenRate = PLAYER_CONFIG.STAMINA_REGENERATION_RATE;
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
      this.playerIsDead && this.characterController
    ) {
      // Stop all movement when dead
      this.characterController.stop(); 
    }

    // Health regeneration
    if (
      !this.playerIsDead &&
      player.stamina.current >= player.stamina.max &&
      player.health.current < player.health.max
    ) {
      player.health.current += PLAYER_CONFIG.HEALTH_REGENERATION_RATE * deltaTime;
      if (player.health.current > player.health.max) {
        player.health.current = player.health.max;
      }
    }

    // Handle player death
    if (player.health.current <= 0 && !this.playerIsDead) {
      this.setDead();
    }
  }

  public takeDamage(amount: number): void {
    if (this.godmode) {
      return;
    }
    if (this.playerIsDead) return;
    
    const player = this.playerEntity;
    if (player) {
        player.health.current -= amount;
        if (player.health.current < 0) player.health.current = 0;
    }

    this.hudManager.showBloodScreenEffect(); // Notify HUDManager
  }

  public setDead(): void {
    this.playerIsDead = true;
    this.hudManager.showDeathScreen(); // Notify HUDManager
    console.log("Player has died.");
  }

  public respawn(): void {
    window.location.reload();
  }

  public isPlayerOnGround(): boolean {
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
        !mesh.name.toLowerCase().includes("spider") && 
        mesh.getTotalVertices() > 0
    );
    return pickInfo?.hit || false;
  }

  // Getters for stats
  public getCurrentHealth(): number {
    return this.playerEntity?.health.current ?? 0;
  }
  public getMaxHealth(): number {
    return this.playerEntity?.health.max ?? 100;
  }
  public getCurrentStamina(): number {
    return this.playerEntity?.stamina.current ?? 0;
  }
  public getMaxStamina(): number {
    return this.playerEntity?.stamina.max ?? 100;
  }

  // Methods for stamina modification
  public depleteStamina(amount: number): void {
    if (this.godmode) {
      return;
    }
    const player = this.playerEntity;
    if (player) {
        player.stamina.current -= amount;
        if (player.stamina.current < 0) player.stamina.current = 0;
    }
  }

  public regenerateStamina(amount: number): void {
    const player = this.playerEntity;
    if (player) {
        player.stamina.current += amount;
        if (player.stamina.current > player.stamina.max)
            player.stamina.current = player.stamina.max;
    }
  }

  public toggleGodmode(): void {
    this.godmode = !this.godmode;
    if (this.godmode) {
      const player = this.playerEntity;
      if (player) {
          player.health.current = player.health.max;
          player.stamina.current = player.stamina.max;
      }
      this.playerIsDead = false;
    }
  }
}
