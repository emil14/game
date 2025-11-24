import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
// CharacterController import removed

import {
  CAMERA_CONFIG,
  PLAYER_CONFIG,
  KEY_MAPPINGS,
  PHYSICS_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";
import { IWeapon } from "./weapons/iweapon";
import { HUDManager } from "./hud_manager";
import { Sword } from "./weapons/sword";
import { world } from "./ecs/world";
import { Sprite } from "@babylonjs/core/Sprites";

export class PlayerManager {
  public camera: UniversalCamera;
  public playerLight: PointLight;
  public playerSword!: IWeapon;

  private scene: Scene;
  private inputManager: InputManager;
  private hudManager: HUDManager;
  private canvas: HTMLCanvasElement;

  // public playerIsDead: boolean = false; // REMOVED - State is in ECS

  public isCrouching: boolean = false;
  private crouchKeyPressedLastFrame: boolean = false;

  public playerBodyMesh!: Mesh;

  // Input flags removed from class state as they are now ECS-driven or local to Update
  // Kept some for internal camera logic if needed

  public godmode: boolean = false;

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
    this.camera.inputs.remove(this.camera.inputs.attached.keyboard);
    this.camera.angularSensibility = CAMERA_CONFIG.ANGULAR_SENSIBILITY;
    this.camera.inertia = CAMERA_CONFIG.INERTIA;

    this.playerLight = new PointLight(
      "playerLight",
      new Vector3(0, 0.5, 0),
      this.scene
    );
    this.playerLight.intensity = CAMERA_CONFIG.PLAYER_LIGHT_INTENSITY;
    this.playerLight.range = CAMERA_CONFIG.PLAYER_LIGHT_RANGE;
    this.playerLight.diffuse = new Color3(1, 0.9, 0.7);
    this.playerLight.parent = this.camera;
  }

  private get playerEntity() {
    return this.playerQuery.first;
  }

  public initializePlayerMesh(playerBodyMesh: Mesh) {
    this.playerBodyMesh = playerBodyMesh;
    this.camera.parent = this.playerBodyMesh;
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
    
    // Attach to Entity
    const playerEntity = this.playerEntity;
    if (playerEntity && playerEntity.player) {
        playerEntity.player.weapon = this.playerSword;
    }
  }

  public updateVisuals(deltaTime: number): void {
    const player = this.playerEntity;
    if (!player) return;

    // Camera Crouch Lerp (Visual Only)
    // We read the state from the Entity, which is the Source of Truth
    const isCrouching = player.input?.isCrouching ?? false;

    const standEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET;
    const crouchHeightDelta = CAMERA_CONFIG.STAND_CAMERA_Y - CAMERA_CONFIG.CROUCH_CAMERA_Y;
    const crouchEyePositionRelToParent = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET - crouchHeightDelta;
    
    const targetLocalCameraY = isCrouching ? crouchEyePositionRelToParent : standEyePositionRelToParent;
    
    this.camera.position.y += (targetLocalCameraY - this.camera.position.y) * Math.min(1, 10 * deltaTime);
  }

  // dealDamageToEntity moved to CombatSystem

  public takeDamage(amount: number): void {
    if (this.godmode) return;
    
    // Check if dead logic handled by PlayerStateSystem
    const player = this.playerEntity;
    if (player && player.health.current > 0) {
        player.health.current -= amount;
        this.hudManager.showBloodScreenEffect();
    }
  }

  // setDead removed - handled by PlayerStateSystem

  public respawn(): void {
    window.location.reload();
  }

  public isPlayerOnGround(): boolean {
    const rayOrigin = this.playerBodyMesh.getAbsolutePosition().clone();
    rayOrigin.y -= PLAYER_CONFIG.PLAYER_HEIGHT / 2;
    const rayLength = PHYSICS_CONFIG.GROUND_CHECK_DISTANCE + 0.1;
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

  public getCurrentHealth(): number { return this.playerEntity?.health.current ?? 0; }
  public getMaxHealth(): number { return this.playerEntity?.health.max ?? 100; }
  public getCurrentStamina(): number { return this.playerEntity?.stamina.current ?? 0; }
  public getMaxStamina(): number { return this.playerEntity?.stamina.max ?? 100; }

  public toggleGodmode(): void {
    this.godmode = !this.godmode;
    if (this.godmode) {
      const player = this.playerEntity;
      if (player) {
          player.health.current = player.health.max;
          player.stamina.current = player.stamina.max;
      }
      // this.playerIsDead = false; // Deprecated
    }
  }
}
