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

import * as config from "./config";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { PlayerManager } from "./player_manager";
import { ClosedChest } from "./interactables";
import AssetManager from "./asset_manager";
import { TabMenuManager } from "./tab_menu_manager";
import { EventSystem } from "./event_system";
import { GameSystems } from "./ecs/game_systems";
import { world } from "./ecs/world";
import { AIManager } from "./ai/ai_manager";
import { EntityFactory } from "./ecs/entity_factory";

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
    this.gameSystems = new GameSystems(this.scene, this.playerManager, this.hudManager);
    this.aiManager = new AIManager();
    this.entityFactory = new EntityFactory(this.scene, this.aiManager.getEntityManager());
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
      stamina: {
        current: this.config.PLAYER_CONFIG.MAX_STAMINA,
        max: this.config.PLAYER_CONFIG.MAX_STAMINA,
        regenRate: this.config.PLAYER_CONFIG.STAMINA_REGENERATION_RATE,
        depletionRate: this.config.PLAYER_CONFIG.STAMINA_DEPLETION_RATE
      },
      player: { id: "p1", camera: this.playerManager.camera } // Pass camera to ECS for InteractionSystem
    });
  }

  private async _initializeGameAssets() {
    // Spiders via ECS Factory
    await this.entityFactory.createSpider(new Vector3(20, 0, 20));

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
    this._initializePlayerPhysics();
    await this._initializeGameAssets();

    this.hudManager.showCoreHud();
    this.hudManager.hideDeathScreen();

    this.gameState = "playing";
    await this.assetManager.initialize();
  }

  public update(): void {
    this._deltaTime = this.engine.getDeltaTime() / 1000;
    
    // 1. Input & Player Control
    this.playerManager.update(this._deltaTime);
    
    // 2. Logic Systems (ECS) - Includes AI, Physics Sync, Combat, Interaction, Animation
    this.gameSystems.update(this._deltaTime, this.isDebugModeEnabled);
    
    // 3. Independent Managers
    this.aiManager.update(); // Updates Yuka's internal time/entities
    this.skyManager.update(this._deltaTime);

    // 4. Game Flow Logic (Aggro check)
    // Could move to a "GameFlowSystem"
    const aggroEnemies = world.with("enemy").where(e => e.enemy.isAggro);
    let isAnyEnemyAggro = false;
    for (const _e of aggroEnemies) {
        isAnyEnemyAggro = true;
        break;
    }

    switch (true) {
      case isAnyEnemyAggro && !this.isInFightMode:
        this.isInFightMode = true;
        break;
      case !isAnyEnemyAggro && this.isInFightMode:
      case this.playerManager.playerIsDead && this.isInFightMode:
        this.isInFightMode = false;
        break;
    }

    // 5. HUD Updates (Reactive where possible, polling for now)
    this.hudManager.updatePlayerStats(
      this.playerManager.getCurrentHealth(),
      this.playerManager.getMaxHealth(),
      this.playerManager.getCurrentStamina(),
      this.playerManager.getMaxStamina()
    );

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
