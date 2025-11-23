import { Scene } from "@babylonjs/core";

export default class AssetManager {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public async initialize(): Promise<void> {
    // Placeholder for preloading assets
    if (!this.scene) return;
  }

  public async loadAssetWithCollider(/* params TBD */): Promise<void> {
    // Placeholder for asset loading logic
  }
}
