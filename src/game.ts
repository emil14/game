import { Engine, Scene, Vector3, Color3, Ray } from "@babylonjs/core";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";
import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

import * as config from "./config";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { PlayerManager } from "./player_manager";
import { Spider } from "./enemies/spider";
import { ClosedChest } from "./interactables";
import AssetManager from "./asset_manager";
import { TabMenuManager } from "./tab_menu_manager";
import { EventSystem } from "./event_system";
import { GameSystems } from "./ecs/game_systems";
import { world } from "./ecs/world"; // Miniplex world

export class Game {
  public readonly engine: Engine;
  public readonly scene: Scene;
  public readonly config = config;
  public readonly inputManager: InputManager;
  public readonly skyManager: SkyManager;
  public readonly hudManager: HUDManager;
  public readonly playerManager: PlayerManager;
  public readonly tabMenuManager: TabMenuManager;
  private readonly canvas: HTMLCanvasElement;

  private _deltaTime: number = 0;
  private spiders: Spider[] = [];
  private isInFightMode: boolean = this.config.GAME_SETTINGS.DEBUG_START_MODE;
  private isDebugModeEnabled: boolean =
    this.config.GAME_SETTINGS.DEBUG_START_MODE;
  private debugRayHelper: RayHelper | null = null;
  private crosshairMaxDistance: number =
    this.config.PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE;
  private havokInstance: any;
  private wallPositions: [number, number, number, number][] = [];
  public gameState: "initializing" | "playing" | "paused" | "menu" =
    "initializing";
  public readonly assetManager: AssetManager;
  public readonly eventSystem: EventSystem;
  public readonly gameSystems: GameSystems;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.inputManager = new InputManager(this.canvas);
    this.skyManager = new SkyManager(this.scene);
    this.hudManager = new HUDManager(this.engine, this.scene);
    this.playerManager = new PlayerManager(
      this.scene,
      this.inputManager,
      this.hudManager,
      this.canvas
    );
    this.tabMenuManager = new TabMenuManager(
      this.engine,
      this.canvas,
      this.playerManager,
      this.hudManager,
      this.skyManager
    );
    this.wallPositions = [
      [
        0,
        this.config.WORLD_CONFIG.GROUND_SIZE / 2,
        this.config.WORLD_CONFIG.GROUND_SIZE,
        this.config.WORLD_CONFIG.WALL_THICKNESS,
      ],
      [
        0,
        -this.config.WORLD_CONFIG.GROUND_SIZE / 2,
        this.config.WORLD_CONFIG.GROUND_SIZE,
        this.config.WORLD_CONFIG.WALL_THICKNESS,
      ],
      [
        -this.config.WORLD_CONFIG.GROUND_SIZE / 2,
        0,
        this.config.WORLD_CONFIG.WALL_THICKNESS,
        this.config.WORLD_CONFIG.GROUND_SIZE,
      ],
      [
        this.config.WORLD_CONFIG.GROUND_SIZE / 2,
        0,
        this.config.WORLD_CONFIG.WALL_THICKNESS,
        this.config.WORLD_CONFIG.GROUND_SIZE,
      ],
    ];
    this.assetManager = new AssetManager(this.scene);
    this.eventSystem = new EventSystem();
    this.gameSystems = new GameSystems(this.scene, this.playerManager);
  }

  private async _loadAssetWithCollider(
    name: string,
    filePathKey: keyof typeof config.ASSET_PATHS,
    fileNameKey: keyof typeof config.ASSET_PATHS,
    position: Vector3,
    scaling: Vector3,
    isDynamicCollider = false,
    onLoaded?: (collider: AbstractMesh, visual: AbstractMesh) => void,
    colliderWidthOverride?: number,
    colliderHeightOverride?: number,
    colliderDepthOverride?: number
  ) {
    try {
      const result = await SceneLoader.ImportMeshAsync(
        "",
        this.config.ASSET_PATHS[filePathKey],
        this.config.ASSET_PATHS[fileNameKey],
        this.scene
      );
      const visualMesh = result.meshes[0] as AbstractMesh;
      visualMesh.name = `${name}Visual`;
      visualMesh.position = position.clone();
      visualMesh.scaling = scaling.clone();
      visualMesh.checkCollisions = false;
      visualMesh
        .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
        .forEach((childMesh) => (childMesh.checkCollisions = false));

      visualMesh.computeWorldMatrix(true);
      const boundingInfo = visualMesh.getHierarchyBoundingVectors(true);
      const dimensions = boundingInfo.max.subtract(boundingInfo.min);

      const colliderWidth =
        colliderWidthOverride !== undefined
          ? colliderWidthOverride
          : dimensions.x > 0
          ? dimensions.x
          : 0.1;
      const colliderHeight =
        colliderHeightOverride !== undefined
          ? colliderHeightOverride
          : dimensions.y > 0
          ? dimensions.y
          : 0.1;
      const colliderDepth =
        colliderDepthOverride !== undefined
          ? colliderDepthOverride
          : dimensions.z > 0
          ? dimensions.z
          : 0.1;

      const collider = MeshBuilder.CreateBox(
        `${name}Collider`,
        {
          width: colliderWidth,
          height: colliderHeight,
          depth: colliderDepth,
        },
        this.scene
      );

      collider.isVisible = this.isDebugModeEnabled;
      collider.checkCollisions = true;

      visualMesh.parent = collider;
      visualMesh.position = Vector3.Zero();
      collider.position = position;

      new PhysicsAggregate(
        collider,
        PhysicsShapeType.BOX,
        {
          mass: isDynamicCollider ? 1 : 0,
          friction: 0.5,
          restitution: 0.1,
        },
        this.scene
      );

      if (onLoaded) onLoaded(collider, visualMesh);
      return { collider, visualMesh };
    } catch (error) {
      console.error(`Failed to load asset ${name}:`, error);
      return null;
    }
  }

  private _createGround() {
    const ground = MeshBuilder.CreateGround(
      "ground1",
      {
        width: this.config.WORLD_CONFIG.GROUND_SIZE,
        height: this.config.WORLD_CONFIG.GROUND_SIZE,
        subdivisions: 2,
      },
      this.scene
    );
    const groundMaterial = new StandardMaterial("groundMaterial", this.scene);
    groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
    const sandTexture = new Texture(
      this.config.ASSET_PATHS.SAND_TEXTURE,
      this.scene
    );
    groundMaterial.diffuseTexture = sandTexture;
    (groundMaterial.diffuseTexture as Texture).uScale = 8;
    (groundMaterial.diffuseTexture as Texture).vScale = 8;
    ground.material = groundMaterial;
    ground.checkCollisions = true;
    new PhysicsAggregate(
      ground,
      PhysicsShapeType.BOX,
      {
        mass: 0,
        friction: this.config.PHYSICS_CONFIG.GROUND_FRICTION,
        restitution: this.config.PHYSICS_CONFIG.GROUND_RESTITUTION,
      },
      this.scene
    );
  }

  private _createWalls() {
    const wallHeight = this.config.WORLD_CONFIG.WALL_HEIGHT;
    this.wallPositions.forEach((props, i) => {
      const wall = MeshBuilder.CreateBox(
        `wall${i + 1}`,
        { width: props[2], height: wallHeight, depth: props[3] },
        this.scene
      );
      wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
      wall.isVisible = this.isDebugModeEnabled;
      wall.checkCollisions = true;
      new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          friction: this.config.PHYSICS_CONFIG.WALL_FRICTION,
          restitution: this.config.PHYSICS_CONFIG.WALL_RESTITUTION,
        },
        this.scene
      );
    });
  }

  private _initializePlayerPhysics() {
    const playerStartPos = new Vector3(0, 1.0, -5);
    const playerBodyMeshInstance = MeshBuilder.CreateCapsule(
      "playerBody",
      {
        radius: this.config.PLAYER_CONFIG.PLAYER_RADIUS,
        height: this.config.PLAYER_CONFIG.PLAYER_HEIGHT,
        tessellation: 20,
      },
      this.scene
    );
    playerBodyMeshInstance.position = playerStartPos.clone();
    playerBodyMeshInstance.position.y =
      playerStartPos.y + this.config.PLAYER_CONFIG.PLAYER_HEIGHT / 2;
    playerBodyMeshInstance.isVisible = this.isDebugModeEnabled;
    
    // CharacterController requires the mesh to have checkCollisions enabled
    // and handles movement/gravity itself, so we don't attach a PhysicsAggregate here.
    playerBodyMeshInstance.checkCollisions = true;
    playerBodyMeshInstance.ellipsoid = new Vector3(
        this.config.PLAYER_CONFIG.PLAYER_RADIUS,
        this.config.PLAYER_CONFIG.PLAYER_HEIGHT / 2,
        this.config.PLAYER_CONFIG.PLAYER_RADIUS
    );
    // Capsule pivot is at center, so (0,0,0) offset matches the visual mesh
    playerBodyMeshInstance.ellipsoidOffset = new Vector3(0, 0, 0);

    this.playerManager.initializeCharacterController(
      playerBodyMeshInstance
    );

    // Create Player Entity in ECS
    world.add({
      transform: { mesh: playerBodyMeshInstance },
      health: { 
        current: this.config.PLAYER_CONFIG.MAX_HEALTH, 
        max: this.config.PLAYER_CONFIG.MAX_HEALTH 
      },
      player: { id: "p1" } // Tag it as player
    });
  }

  private async _initializeGameAssets() {
    // Spiders
    const spiderInstance = await Spider.Create(
      this.scene,
      new Vector3(20, 0, 20),
      this.config.PLAYER_CONFIG.DEFAULT_SPEED
    );
    this.spiders.push(spiderInstance);
    spiderInstance.setOnPlayerDamaged((damage: number) => {
      if (this.playerManager.playerIsDead) return;
      this.playerManager.takeDamage(damage);
    });

    await this.playerManager.initializeSword();

    // Palm trees
    await this._loadAssetWithCollider(
      "palmTree1",
      "PIRATE_KIT_MODELS",
      "PALM_TREE_1_GLB",
      new Vector3(10, 0, 10),
      new Vector3(2, 2, 2),
      false,
      undefined,
      3.0,
      undefined,
      3.0
    );
    await this._loadAssetWithCollider(
      "palmTree2",
      "PIRATE_KIT_MODELS",
      "PALM_TREE_2_GLB",
      new Vector3(5, 0, 15),
      new Vector3(1.8, 1.8, 1.8),
      false,
      undefined,
      2.7,
      undefined,
      2.7
    );
    await this._loadAssetWithCollider(
      "palmTree3",
      "PIRATE_KIT_MODELS",
      "PALM_TREE_3_GLB",
      new Vector3(-5, 0, 15),
      new Vector3(2.2, 2.2, 2.2),
      false,
      undefined,
      3.3,
      undefined,
      3.3
    );
    await this._loadAssetWithCollider(
      "chestClosed",
      "PIRATE_KIT_MODELS",
      "CHEST_CLOSED_GLB",
      new Vector3(18, 0, 18),
      new Vector3(1, 1, 1),
      false,
      (collider) => {
        new ClosedChest(collider as Mesh, true, "key_old_chest", () => {
          if (collider.metadata && collider.metadata.chestInstance) {
            const ray = this.playerManager.camera.getForwardRay(
              this.config.PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE
            );
            const pickInfo = this.scene.pickWithRay(
              ray,
              (mesh) => mesh === collider
            );
            if (pickInfo && pickInfo.hit) {
              this.hudManager.setCrosshairText(
                (
                  collider.metadata.chestInstance as ClosedChest
                ).getDisplayIcon()
              );
            }
          }
        });
      },
      2.25,
      2.25,
      2.25
    );
  }

  public async initialize(): Promise<void> {
    this.gameState = "initializing";

    // Physics
    this.havokInstance = await HavokPhysics({
      locateFile: (file: string) =>
        file.endsWith(".wasm")
          ? this.config.PHYSICS_CONFIG.HAVOK_WASM_PATH
          : file,
    });
    const havokPlugin = new HavokPlugin(true, this.havokInstance);
    this.scene.enablePhysics(
      new Vector3(0, this.config.PHYSICS_CONFIG.GRAVITY_Y, 0),
      havokPlugin
    );
    this._createGround();
    this._createWalls();
    this._initializePlayerPhysics();
    await this._initializeGameAssets();

    this.hudManager.showCoreHud();
    this.hudManager.hideDeathScreen();

    this.gameState = "playing";
    await this.assetManager.initialize();
  }

  public update(): void {
    this._deltaTime = this.engine.getDeltaTime() / 1000;
    this.playerManager.update(this._deltaTime);
    this.gameSystems.update(this._deltaTime); // Update ECS systems
    this.skyManager.update(this._deltaTime);
    let isAnyEnemyAggro = false;
    if (!this.playerManager.playerIsDead) {
      this.spiders.forEach((spider) => {
        if (spider.currentHealth > 0) {
          spider.update(this._deltaTime, this.playerManager.camera);
          if (spider.getIsAggro()) isAnyEnemyAggro = true;
        }
      });
    }
    if (isAnyEnemyAggro && !this.isInFightMode) {
      this.isInFightMode = true;
    } else if (!isAnyEnemyAggro && this.isInFightMode) {
      this.isInFightMode = false;
    }
    this.hudManager.updatePlayerStats(
      this.playerManager.getCurrentHealth(),
      this.playerManager.getMaxHealth(),
      this.playerManager.getCurrentStamina(),
      this.playerManager.getMaxStamina()
    );
    if (
      this.playerManager.playerIsDead &&
      this.isInFightMode
    ) {
      this.isInFightMode = false;
    }
    // Crosshair targeting system
    this.playerManager.camera.computeWorldMatrix();
    const rayOrigin = this.playerManager.camera.globalPosition;
    const forwardDirection = this.playerManager.camera.getDirection(
      Vector3.Forward()
    );
    const ray = new Ray(rayOrigin, forwardDirection, this.crosshairMaxDistance);
    if (this.isDebugModeEnabled) {
      if (!this.debugRayHelper) {
        this.debugRayHelper = RayHelper.CreateAndShow(
          ray,
          this.scene,
          new Color3(1, 1, 0)
        );
      } else {
        this.debugRayHelper.ray = ray;
      }
    } else {
      if (this.debugRayHelper) {
        this.debugRayHelper.dispose();
        this.debugRayHelper = null;
      }
    }
    const pickInfo = this.scene.pickWithRay(
      ray,
      (mesh) =>
        (mesh.metadata && mesh.metadata.enemyType === "spider") ||
        (mesh.metadata && mesh.metadata.interactableType)
    );
    let crosshairSetForSpecificTarget = false;
    if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
      const pickedMesh = pickInfo.pickedMesh;
      if (pickedMesh.metadata && pickedMesh.metadata.enemyType === "spider") {
        const spiderInstance = pickedMesh.metadata.instance as Spider;
        if (
          spiderInstance &&
          (spiderInstance.getIsDying() || spiderInstance.currentHealth <= 0)
        ) {
          this.hudManager.setCrosshairText("✋");
          this.hudManager.setCrosshairFocus(false);
          this.hudManager.hideEnemyInfo();
          crosshairSetForSpecificTarget = true;
        } else if (spiderInstance) {
          this.hudManager.showEnemyInfo(
            spiderInstance.name,
            spiderInstance.level,
            spiderInstance.currentHealth,
            spiderInstance.maxHealth
          );
          this.hudManager.setCrosshairText("💢");
          this.hudManager.setCrosshairFocus(true);
          crosshairSetForSpecificTarget = true;
        }
      } else if (
        pickedMesh.metadata &&
        pickedMesh.metadata.interactableType === "chest"
      ) {
        const chestInstance = pickedMesh.metadata.chestInstance as ClosedChest;
        this.hudManager.setCrosshairText(chestInstance.getDisplayIcon());
        this.hudManager.setCrosshairFocus(false);
        this.hudManager.hideEnemyInfo();
        crosshairSetForSpecificTarget = true;
      }
    }
    if (!crosshairSetForSpecificTarget) {
      this.hudManager.hideEnemyInfo();
      this.hudManager.setCrosshairFocus(false);
      this.hudManager.setCrosshairText("•");
    }
    this.hudManager.updateFPS();
  }

  public async start(): Promise<void> {
    await this.initialize();
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
    this.engine.runRenderLoop(() => {
      if (this.scene.isReady() && this.engine.getDeltaTime() > 0) {
        this.update();
        this.scene.render();
      }
    });
  }
}
