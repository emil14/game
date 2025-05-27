import { Engine, Scene } from "@babylonjs/core";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { PlayerManager } from "./player_manager";
import * as config from "./config";

export class Game {
  public readonly engine: Engine;
  public readonly scene: Scene;
  public readonly config = config;
  public readonly inputManager: InputManager;
  public readonly skyManager: SkyManager;
  public readonly hudManager: HUDManager;
  public readonly playerManager: PlayerManager;
  private readonly canvas: HTMLCanvasElement;

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
  }
}
