import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Animation } from "@babylonjs/core/Animations/animation";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/loaders/glTF";

export class SwordFactory {
  private static templateMesh: AbstractMesh | null = null;
  private static assetsLoadingPromise: Promise<void> | null = null;

  public static async loadAssets(scene: Scene): Promise<void> {
    if (this.assetsLoadingPromise) {
      return this.assetsLoadingPromise;
    }

    this.assetsLoadingPromise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "",
          "assets/models/pirate_kit/",
          "sword.glb",
          scene
        );
        this.templateMesh = result.meshes[0];
        if (this.templateMesh) {
          this.templateMesh.name = "swordTemplate";
          this.templateMesh.setEnabled(false);
        } else {
          throw new Error("Sword template mesh not found.");
        }
      } catch (error) {
        console.error("Failed to load sword assets:", error);
        this.assetsLoadingPromise = null;
        throw error;
      }
    })();
    return this.assetsLoadingPromise;
  }

  public static create(scene: Scene, parent: Camera): { mesh: AbstractMesh; animation: Animation } {
    if (!this.templateMesh) {
      throw new Error("Sword assets not loaded. Call loadAssets first.");
    }

    const mesh = this.templateMesh.clone(
      "playerSword_" + Date.now().toString(36),
      parent,
      false
    )!;
    
    mesh.setEnabled(true);
    mesh.position = new Vector3(0.35, -0.35, 1.2);
    mesh.rotationQuaternion = null;
    mesh.rotation = new Vector3(0, Math.PI / 12 + Math.PI / 2, 0);
    mesh.scaling = new Vector3(0.7, 0.7, 0.7);
    mesh.receiveShadows = false;
    mesh.renderingGroupId = 1;

    mesh.getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
      .forEach((child) => {
        child.receiveShadows = false;
        child.checkCollisions = false;
        child.renderingGroupId = 1;
      });
    mesh.checkCollisions = false;

    // Create Animation
    const swingAnimation = new Animation(
      "swordSwingAnim",
      "rotation.z",
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    // Default keys, will be updated by system if needed, but good to have defaults
    const initialRotationZ = mesh.rotation.z;
    const swingAngle = Math.PI / 3;
    const swingDurationFrames = 15;

    const swingKeys = [
      { frame: 0, value: initialRotationZ },
      { frame: swingDurationFrames / 3, value: initialRotationZ + swingAngle },
      { frame: swingDurationFrames, value: initialRotationZ },
    ];
    swingAnimation.setKeys(swingKeys);

    return { mesh, animation: swingAnimation };
  }
}
