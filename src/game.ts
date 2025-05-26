import { Engine, Scene } from "@babylonjs/core";

export class Game {
  public readonly engine: Engine;
  public readonly scene: Scene;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
  }
}
