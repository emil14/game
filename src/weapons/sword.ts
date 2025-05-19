import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Animation } from "@babylonjs/core/Animations/animation";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

export class Sword {
  public visualMesh!: AbstractMesh;
  private scene: Scene;
  private camera: FreeCamera; // Sword is parented to camera

  private swingAnimation: Animation | null = null;
  private isSwinging: boolean = false;
  public attackDamage: number = 15; // Default damage, can be configured

  // Static properties for template assets
  private static templateMesh: AbstractMesh | null = null;
  private static assetsLoadingPromise: Promise<void> | null = null;

  private constructor(scene: Scene, camera: FreeCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  private static async _loadAndCacheTemplateAssets(
    scene: Scene
  ): Promise<void> {
    if (this.assetsLoadingPromise) {
      return this.assetsLoadingPromise; // Already loading or loaded
    }

    this.assetsLoadingPromise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          "", // meshNames - import all
          "assets/models/pirate_kit/",
          "sword.glb",
          scene
        );
        this.templateMesh = result.meshes[0];
        if (this.templateMesh) {
          this.templateMesh.name = "swordTemplate";
          this.templateMesh.setEnabled(false); // Keep the template hidden
        } else {
          console.error(
            "Sword template mesh not found in GLB. Ensure 'sword.glb' contains meshes."
          );
          throw new Error("Sword template mesh not found.");
        }
      } catch (error) {
        console.error("Failed to load sword template assets:", error);
        this.assetsLoadingPromise = null; // Allow retry on next Create
        throw error; // Re-throw to fail the Sword.Create call
      }
    })();
    return this.assetsLoadingPromise;
  }

  public static async Create(
    scene: Scene,
    camera: FreeCamera,
    attackDamage: number = 15
  ): Promise<Sword> {
    await Sword._loadAndCacheTemplateAssets(scene);
    if (!Sword.templateMesh) {
      throw new Error(
        "Sword template assets failed to load, cannot create instance."
      );
    }

    const swordInstance = new Sword(scene, camera);
    swordInstance.attackDamage = attackDamage;
    swordInstance.initializeInstanceAssets();
    swordInstance._setupSwingAnimation();
    return swordInstance;
  }

  private initializeInstanceAssets(): void {
    if (!Sword.templateMesh) {
      console.error(
        "Cannot initialize sword instance: Template mesh not loaded."
      );
      return;
    }

    // Clone the template mesh. The true for newParent means it will be parented.
    // The false for doNotCloneChildren means children will be cloned.
    this.visualMesh = Sword.templateMesh.clone(
      "playerSwordInstance_" + Date.now().toString(36),
      this.camera,
      false
    )!;
    this.visualMesh.setEnabled(true); // Ensure the cloned visual mesh is enabled

    // Set properties as they were in main.ts
    this.visualMesh.position = new Vector3(0.35, -0.35, 1.2); // Position relative to camera
    this.visualMesh.rotationQuaternion = null; // Use Euler angles for rotation
    this.visualMesh.rotation = new Vector3(0, Math.PI / 12 + Math.PI / 2, 0);
    this.visualMesh.scaling = new Vector3(0.7, 0.7, 0.7);
    this.visualMesh.receiveShadows = false;
    this.visualMesh.renderingGroupId = 1; // Render in a specific group (e.g. for FPS weapon)

    // Ensure children of the sword also have these properties
    this.visualMesh
      .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
      .forEach((mesh) => {
        mesh.receiveShadows = false;
        mesh.checkCollisions = false; // Sword parts should not have collision
        mesh.renderingGroupId = 1;
      });
    this.visualMesh.checkCollisions = false; // The root of the sword should not have collision
  }

  private _setupSwingAnimation(): void {
    // Animation setup as it was in main.ts
    this.swingAnimation = new Animation(
      "swordSwingInstanceAnim", // Unique name for the animation instance
      "rotation.z", // Property to animate
      30, // Frames per second
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT // Play once
    );
  }

  public swing(
    crosshairMaxDistance: number,
    targetFilter: (mesh: AbstractMesh) => boolean,
    onTargetHit: (targetMesh: AbstractMesh, instance?: any) => void
  ): void {
    if (
      this.isSwinging ||
      !this.visualMesh ||
      !this.swingAnimation ||
      !this.camera
    ) {
      return; // Already swinging, or mesh/animation not ready
    }
    this.isSwinging = true;

    const initialRotationZ = this.visualMesh.rotation.z;
    const swingAngle = Math.PI / 3; // How far the sword swings
    const swingDurationFrames = 15; // Total frames for the swing animation

    // Define keyframes for the swing
    const swingKeys = [
      { frame: 0, value: initialRotationZ },
      { frame: swingDurationFrames / 3, value: initialRotationZ + swingAngle }, // Apex of the swing
      { frame: swingDurationFrames, value: initialRotationZ }, // Return to original position
    ];
    this.swingAnimation.setKeys(swingKeys);

    const damageApplicationDelayMs = 150; // When to check for a hit during the swing

    // Schedule hit detection
    setTimeout(() => {
      if (!this.visualMesh || !this.camera) {
        // Ensure sword is still valid
        this.isSwinging = false; // Reset if sword became invalid
        return;
      }
      const ray = this.camera.getForwardRay(crosshairMaxDistance);
      const pickInfo = this.scene.pickWithRay(ray, targetFilter);

      if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
        onTargetHit(
          pickInfo.pickedMesh,
          pickInfo.pickedMesh.metadata?.instance
        );
      }
    }, damageApplicationDelayMs);

    // Start the animation
    this.scene.beginDirectAnimation(
      this.visualMesh,
      [this.swingAnimation],
      0, // Start frame
      swingDurationFrames, // End frame
      false, // Loop animation?
      1.0, // Speed ratio
      () => {
        // Animation ended callback
        this.isSwinging = false;
      }
    );
  }

  public getIsSwinging(): boolean {
    return this.isSwinging;
  }

  public dispose(): void {
    this.visualMesh?.dispose(false, true); // Dispose mesh, but not materials if shared
    // @ts-ignore
    this.visualMesh = null;
    this.swingAnimation = null;
    // Potentially stop and remove animations from scene if they were added globally,
    // but beginDirectAnimation handles this fairly well for direct targets.
  }
}
