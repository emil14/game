import { Engine, Scene, Vector3, Color3 } from "@babylonjs/core";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PhysicsRegistry } from "./ecs/physics_registry";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

import * as config from "./config";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { ClosedChest } from "./interactables";
import AssetManager from "./asset_manager";
import { TabMenuManager } from "./tab_menu_manager";
import { EventSystem } from "./event_system";
import { GameSystems } from "./ecs/game_systems";
import { world } from "./ecs/world";
import { AIManager } from "./ai/ai_manager";
import { EntityFactory } from "./ecs/entity_factory";
import { Sword } from "./weapons/sword";

export class Game {
  public readonly engine: Engine;
  public readonly scene: Scene;
  public readonly config = config;
  public readonly inputManager: InputManager;
  public readonly skyManager: SkyManager;
  public readonly hudManager: HUDManager;
  public readonly tabMenuManager: TabMenuManager;
  public readonly camera: UniversalCamera;
  public readonly playerLight: PointLight;
  private readonly canvas: HTMLCanvasElement;

  private _deltaTime: number = 0;
  private isInFightMode: boolean = this.config.GAME_SETTINGS.DEBUG_START_MODE;
  private isDebugModeEnabled: boolean =
    this.config.GAME_SETTINGS.DEBUG_START_MODE;
  private havokInstance: any;
  private wallPositions: [number, number, number, number][] = [];
  public gameState: "initializing" | "playing" | "paused" | "menu" =
    "initializing";
  public readonly assetManager: AssetManager;
  public readonly eventSystem: EventSystem;
  public readonly gameSystems: GameSystems;
  public readonly aiManager: AIManager;
  private entityFactory: EntityFactory;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.inputManager = new InputManager(this.canvas);
    this.skyManager = new SkyManager(this.scene);
    this.hudManager = new HUDManager(this.engine, this.scene);
    
    // --- Camera Setup ---
    this.camera = new UniversalCamera(
      "playerCamera",
      new Vector3(0, this.config.CAMERA_CONFIG.STAND_CAMERA_Y, -5),
      this.scene
    );
    this.camera.maxZ = this.config.CAMERA_CONFIG.MAX_Z;
    this.camera.setTarget(Vector3.Zero()); 
    this.camera.attachControl(this.canvas, true);
    this.camera.inputs.remove(this.camera.inputs.attached.keyboard);
    this.camera.angularSensibility = this.config.CAMERA_CONFIG.ANGULAR_SENSIBILITY;
    this.camera.inertia = this.config.CAMERA_CONFIG.INERTIA;

    this.playerLight = new PointLight(
      "playerLight",
      new Vector3(0, 0.5, 0),
      this.scene
    );
    this.playerLight.intensity = this.config.CAMERA_CONFIG.PLAYER_LIGHT_INTENSITY;
    this.playerLight.range = this.config.CAMERA_CONFIG.PLAYER_LIGHT_RANGE;
    this.playerLight.diffuse = new Color3(1, 0.9, 0.7);
    this.playerLight.parent = this.camera;
    
    this.tabMenuManager = new TabMenuManager(
      this.engine,
      this.canvas,
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
    this.gameSystems = new GameSystems(this.scene, this.inputManager, this.hudManager);
    this.aiManager = new AIManager();
    this.entityFactory = new EntityFactory(
      this.scene, 
      this.aiManager.getEntityManager(),
      this.camera
    );
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

  private async _initializeGameAssets() {
    // Spiders via ECS Factory
    await this.entityFactory.createSpider(new Vector3(20, 0, 20));

    // Initialize Sword
    const playerSword = await Sword.Create(
      this.scene,
      this.camera,
      this.config.PLAYER_CONFIG.SWORD_DAMAGE
    );
    // Attach to Entity
    const playerEntity = world.with("player").first;
    if (playerEntity && playerEntity.player) {
        playerEntity.player.weapon = playerSword;
    }

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
          // Interaction system handles crosshair, this handles logic for now
          // Ideally chest logic also moves to ECS InteractionSystem eventually
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
    await this.entityFactory.createPlayer();
    await this._initializeGameAssets();

    this.hudManager.showCoreHud();
    this.hudManager.hideDeathScreen();

    this.gameState = "playing";
    await this.assetManager.initialize();
  }

  public update(): void {
    this._deltaTime = this.engine.getDeltaTime() / 1000;
    
    // 1. Independent Managers (Time, Sky, AI Decisions)
    this.skyManager.update(this._deltaTime);
    this.aiManager.update(); // Update Yuka first so it sets Desired Velocity

    // 2. Logic Systems (ECS)
    // Runs: Timers -> Input -> Player Control -> AI Steering -> Combat -> Physics Sync -> Animation
    this.gameSystems.update(this._deltaTime, this.isDebugModeEnabled);

    // 3. Visual / Legacy Managers
    // Camera moved to ECS
    
    // 4. Game Flow Logic (Aggro check)
    // Could move to a "GameFlowSystem"
    const aggroEnemies = world.with("enemy").where(e => e.enemy.isAggro);
    let isAnyEnemyAggro = false;
    for (const _e of aggroEnemies) {
        isAnyEnemyAggro = true;
        break;
    }

    // Zero Tolerance: We expect player entity to exist if we are calculating game flow involving player health.
    const player = world.with("player", "health", "stamina").first;
    // However, if we are in a 'game over' state, player might be dead/removed? 
    // In this codebase, player entity persists but health goes to 0. 
    // If player is missing, something is critically wrong -> Let it crash or assume 0 health safely?
    // "Zero tolerance" implies we fix the root cause if player is missing, so assuming it exists is valid if initialization is guaranteed.
    // But safely defaulting to 0 health avoids crash during shutdown/init.
    const currentHealth = player?.health.current ?? 0;

    switch (true) {
      case isAnyEnemyAggro && !this.isInFightMode:
        this.isInFightMode = true;
        break;
      case !isAnyEnemyAggro && this.isInFightMode:
      case currentHealth <= 0 && this.isInFightMode:
        this.isInFightMode = false;
        break;
    }

    // 5. HUD Updates (Reactive where possible, polling for now)
    // Deprecated: Moving to HUDSystem? 
    
    // Let's rely on HUDManager.update() if we create one, or just keep this bridge for now 
    // but ensure it reads from ECS.
    if (player) {
        this.hudManager.updatePlayerStats(
          player.health.current,
          player.health.max,
          player.stamina.current,
          player.stamina.max
        );
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
