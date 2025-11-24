import { Engine, Scene, Vector3, Color3 } from "@babylonjs/core";
import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

import * as config from "./config";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import AssetManager from "./asset_manager";
import { TabMenuManager } from "./tab_menu_manager";
import { EventSystem } from "./event_system";
import { GameSystems } from "./ecs/game_systems";
import { AIManager } from "./ai/ai_manager";
import { EntityFactory } from "./ecs/entity_factory";
import { LevelManager } from "./managers/level_manager";

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
  private isDebugModeEnabled: boolean =
    this.config.GAME_SETTINGS.DEBUG_START_MODE;
  private havokInstance: any;
  public gameState: "initializing" | "playing" | "paused" | "menu" =
    "initializing";
  public readonly assetManager: AssetManager;
  public readonly eventSystem: EventSystem;
  public readonly gameSystems: GameSystems;
  public readonly aiManager: AIManager;
  private entityFactory: EntityFactory;
  private levelManager: LevelManager;

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

    this.assetManager = new AssetManager(this.scene);
    this.eventSystem = new EventSystem();
    
    // Reordered: Initialize AIManager FIRST, then pass to GameSystems
    this.aiManager = new AIManager();
    this.gameSystems = new GameSystems(
      this.scene, 
      this.inputManager, 
      this.hudManager,
      this.aiManager
    );

    this.entityFactory = new EntityFactory(
      this.scene, 
      this.aiManager.getEntityManager(),
      this.camera
    );
    this.levelManager = new LevelManager(this.scene, this.entityFactory);
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

    await this.levelManager.initialize();
    await this.entityFactory.createPlayer();

    this.hudManager.showCoreHud();
    this.hudManager.hideDeathScreen();

    this.gameState = "playing";
    await this.assetManager.initialize();
  }

  public update(): void {
    this._deltaTime = this.engine.getDeltaTime() / 1000;
    
    // 1. Independent Managers (Time, Sky)
    this.skyManager.update(this._deltaTime);
    // aiManager.update() is now handled within GameSystems for proper orchestration

    // 2. Logic Systems (ECS)
    // Runs: Timers -> Input -> Player Control -> AI (Plan/Steer/Sync) -> Combat -> Animation -> Camera -> Game Flow -> HUD -> Interaction
    this.gameSystems.update(this._deltaTime, this.isDebugModeEnabled);

    // 3. Visual / Legacy Managers
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
