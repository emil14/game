import { Scene } from "@babylonjs/core/scene";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SpriteManager, Sprite } from "@babylonjs/core/Sprites";

import { IEnemy } from "./ienemy";

export class Spider implements IEnemy {
  /** The mesh used as the physics body's transform node and for raycast targeting. */
  public colliderMesh!: Mesh;
  /** The physics aggregate for the spider. */
  public physicsAggregate!: PhysicsAggregate;
  /** The visual representation (3D model) of the spider. */
  public visualMesh!: AbstractMesh;
  private scene: Scene;

  // Instance-specific animation players
  private walkAnimation: AnimationGroup | null = null;
  private idleAnimation: AnimationGroup | null = null;
  private attackAnimation: AnimationGroup | null = null;
  private deathAnimation: AnimationGroup | null = null;
  private attackAnimationDurationSeconds: number;

  // Static properties for template assets
  private static templateRootMesh: AbstractMesh | null = null;
  // private static templateSkeleton: Skeleton | null = null; // Skeleton cloning handled by mesh.clone
  private static templateAnimationGroups: AnimationGroup[] = [];
  private static templateAttackAnimDuration: number = 0.75; // Default
  private static assetsLoadingPromise: Promise<void> | null = null;
  public static bloodSplatManager: SpriteManager;

  public readonly name: string = "Spider";
  public readonly level: number = 1;
  public maxHealth: number = 50;
  public currentHealth: number;
  private attackDamage: number = 10;
  private attackCooldown: number = 1.5;
  private timeSinceLastAttack: number = 0;

  private speed: number;
  private aggroRadius: number = 20.0;
  private stoppingDistance: number = 2.5;

  private isCurrentlyAggro: boolean = false;
  private isCurrentlyAttacking: boolean = false;
  private isDying: boolean = false;

  private onPlayerDamagedCallback: (damage: number) => void = () => {};

  /**
   * Private constructor. Instances are created via the static \`Create\` method.
   * @param scene The BabylonJS scene.
   * @param speed The movement speed of the spider.
   */
  private constructor(scene: Scene, speed: number) {
    this.scene = scene;
    this.speed = speed;
    this.currentHealth = this.maxHealth;
    this.timeSinceLastAttack = this.attackCooldown; // Ready to attack
    this.attackAnimationDurationSeconds = Spider.templateAttackAnimDuration;

    Spider.bloodSplatManager = new SpriteManager(
      "blood_splat_manager",
      "assets/blood_effects/splat.png",
      10, // max splats on screen at once
      { width: 256, height: 256 },
      scene
    );
  }

  /**
   * Loads the shared template assets for all Spider instances if not already loaded.
   * This method is called internally and ensures assets are loaded only once.
   * @param scene The BabylonJS scene.
   */
  private static async _loadAndCacheTemplateAssets(
    scene: Scene
  ): Promise<void> {
    if (this.assetsLoadingPromise) {
      return this.assetsLoadingPromise; // Already loading or loaded
    }

    this.assetsLoadingPromise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          null, // meshNames - import all. Pass null to import all meshes.
          "assets/models/enemies/",
          "spider.glb",
          scene
        );

        this.templateRootMesh = result.meshes[0];
        this.templateRootMesh.name = "spiderTemplateRoot";
        this.templateRootMesh.setEnabled(false); // Keep the template hidden/disabled

        // Store all animation groups from the template
        // IMPORTANT: Stop them on the template to prevent them from playing on the hidden template mesh.
        this.templateAnimationGroups = result.animationGroups;
        this.templateAnimationGroups.forEach((ag) => {
          ag.stop();
        });

        // Calculate and store attack animation duration from the template
        const attackAnimTemplate = this.templateAnimationGroups.find(
          (ag) => ag.name === "SpiderArmature|Spider_Attack"
        );
        if (attackAnimTemplate) {
          if (
            attackAnimTemplate.targetedAnimations &&
            attackAnimTemplate.targetedAnimations.length > 0
          ) {
            const anim = attackAnimTemplate.targetedAnimations[0].animation;
            const frameRate = anim.framePerSecond;
            const numFrames = attackAnimTemplate.to - attackAnimTemplate.from;
            if (frameRate > 0 && numFrames > 0) {
              this.templateAttackAnimDuration = numFrames / frameRate;
            } else {
              console.warn(
                "Spider template: Attack animation '" +
                  attackAnimTemplate.name +
                  "' has frameRate 0 or no frames. Using default duration."
              );
            }
          } else {
            console.warn(
              "Spider template: Attack animation group '" +
                attackAnimTemplate.name +
                "' has no targeted animations. Using default duration."
            );
          }
        } else {
          console.warn(
            "Spider template: 'SpiderArmature|Spider_Attack' animation group not found. Using default attack duration."
          );
        }
      } catch (error) {
        console.error("Failed to load spider template assets:", error);
        this.assetsLoadingPromise = null; // Allow retry on next Create
        throw error; // Re-throw to fail the Spider.Create call
      }
    })();
    return this.assetsLoadingPromise;
  }

  /**
   * Asynchronously creates and initializes a new Spider instance.
   * Ensures that template assets are loaded once and then clones them for the instance.
   * @param scene The BabylonJS scene.
   * @param initialWorldPosition The initial world position for the spider.
   * @param speed The movement speed of the spider.
   * @returns A Promise that resolves to a fully initialized Spider instance.
   */
  public static async Create(
    scene: Scene,
    initialWorldPosition: Vector3,
    speed: number
  ): Promise<Spider> {
    await Spider._loadAndCacheTemplateAssets(scene);
    if (!Spider.templateRootMesh) {
      throw new Error(
        "Spider template assets failed to load, cannot create instance."
      );
    }

    const spiderInstance = new Spider(scene, speed);
    spiderInstance.initializeInstanceAssets(initialWorldPosition);
    // Start with idle animation if available and not already playing (e.g. from a previous state)
    if (
      spiderInstance.idleAnimation &&
      !spiderInstance.idleAnimation.isPlaying
    ) {
      spiderInstance.idleAnimation.start(
        true,
        1.0,
        spiderInstance.idleAnimation.from,
        spiderInstance.idleAnimation.to,
        false
      );
    }
    return spiderInstance;
  }

  /**
   * Initializes the instance-specific assets by cloning from the loaded template.
   * This includes the visual mesh, collider, and animation groups.
   * @param initialWorldPosition The initial world position for this spider instance.
   */
  private initializeInstanceAssets(initialWorldPosition: Vector3): void {
    if (!Spider.templateRootMesh) {
      console.error(
        "Cannot initialize spider instance: Template mesh not loaded."
      );
      return;
    }

    const uniqueId =
      Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    // Clone the entire hierarchy from the template root.
    // The third argument `true` for doNotCloneChildren was incorrect, should be `false` or omitted.
    this.visualMesh = Spider.templateRootMesh.clone(
      "spiderVisual_" + uniqueId,
      null,
      false
    )!;
    this.visualMesh.name = "spiderVisual_" + this.name + "_" + uniqueId;
    this.visualMesh.setEnabled(true); // Ensure the cloned visual mesh is enabled
    this.visualMesh.scaling = new Vector3(0.5, 0.5, 0.5); // Set desired scale
    this.visualMesh.checkCollisions = false;
    this.visualMesh
      .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
      .forEach((childMesh) => {
        childMesh.checkCollisions = false;
      });

    // Clone animation groups and retarget them to the new cloned mesh hierarchy.
    // The AnimationGroup.clone method is designed for this.
    Spider.templateAnimationGroups.forEach((templateAg) => {
      const clonedAg = templateAg.clone(
        templateAg.name + "_clone_" + uniqueId,
        (oldTarget: any) => {
          if (!Spider.templateRootMesh || !this.visualMesh) return oldTarget; // Safety check

          if (oldTarget === Spider.templateRootMesh) {
            return this.visualMesh; // Target the new root if the old target was the old root
          }
          // Attempt to find the equivalent target in the new hierarchy by name
          // This assumes a similar structure and naming convention between template and clone.
          if (oldTarget.name) {
            // Search within the cloned visualMesh hierarchy
            const newTarget =
              this.visualMesh
                .getScene()
                .getTransformNodeByName(oldTarget.name) ||
              this.visualMesh.getScene().getMeshByName(oldTarget.name);

            // A more robust way if names aren't unique across the whole scene but are within the hierarchy:
            // Traverse children of this.visualMesh to find by name if the above is too broad.
            // For now, assuming names are specific enough or getTransformNodeByName/getMeshByName works.
            // A common pattern for GLB imports is that node names are unique.

            // To be safer, check if the found newTarget is a descendant of this.visualMesh
            if (newTarget && newTarget.isDescendantOf(this.visualMesh)) {
              return newTarget;
            }
            // Fallback: If not found as a descendant, or oldTarget has no name, what to do?
            // This might indicate a structural difference or an issue with names.
            // console.warn(`Could not retarget ${oldTarget.name} for ${clonedAg?.name}. Using original target or null.`);
          }
          return oldTarget; // Fallback to original target if specific retargeting fails
        }
      );

      if (clonedAg) {
        clonedAg.reset();
        clonedAg.stop();

        // Store references to the cloned animation groups for this instance
        if (templateAg.name === "SpiderArmature|Spider_Walk")
          this.walkAnimation = clonedAg;
        else if (templateAg.name === "SpiderArmature|Spider_Idle")
          this.idleAnimation = clonedAg;
        else if (templateAg.name === "SpiderArmature|Spider_Attack")
          this.attackAnimation = clonedAg;
        else if (templateAg.name === "SpiderArmature|Spider_Death")
          this.deathAnimation = clonedAg;
      } else {
        console.warn("Failed to clone animation group: " + templateAg.name);
      }
    });

    this.visualMesh.position = initialWorldPosition.clone();
    this.visualMesh.computeWorldMatrix(true);

    const boundingInfo = this.visualMesh.getHierarchyBoundingVectors(true);
    const spiderDimensions = boundingInfo.max.subtract(boundingInfo.min);

    // This mesh will be the transformNode for the PhysicsAggregate
    this.colliderMesh = MeshBuilder.CreateBox(
      "spiderCollider_" + this.name + "_" + uniqueId,
      {
        width: Math.max(0.1, spiderDimensions.x),
        height: Math.max(0.1, spiderDimensions.y),
        depth: Math.max(0.1, spiderDimensions.z),
      },
      this.scene
    );

    // this.collider.checkCollisions = true; // Replaced by PhysicsAggregate
    this.colliderMesh.isVisible = false; // Enable for debugging
    this.colliderMesh.metadata = { enemyType: "spider", instance: this };
    this.colliderMesh.position = boundingInfo.min.add(
      spiderDimensions.scale(0.5)
    );

    // Create the PhysicsAggregate for the colliderMesh
    this.physicsAggregate = new PhysicsAggregate(
      this.colliderMesh,
      PhysicsShapeType.BOX, // Or a more fitting shape like CAPSULE if desired later
      {
        mass: 1, // Spiders are dynamic
        friction: 0.5,
        restitution: 0.2,
        // extents: spiderDimensions // Box shape can take extents if not derived from mesh
      },
      this.scene
    );
    if (this.physicsAggregate.body) {
      this.physicsAggregate.body.setMassProperties({
        inertia: new Vector3(0, 0, 0),
      }); // Prevent tipping
    } else {
      console.error(`Failed to create physics body for spider ${this.name}`);
    }

    // if (
    //   spiderDimensions.x > 0 &&
    //   spiderDimensions.y > 0 &&
    //   spiderDimensions.z > 0
    // ) {
    //   // this.collider.ellipsoid = new Vector3( // Not used with PhysicsAggregate directly on box
    //   //   spiderDimensions.x / 2,
    //   //   spiderDimensions.y / 2,
    //   //   spiderDimensions.z / 2
    //   // );
    // } else {
    //   // this.collider.ellipsoid = new Vector3(0.05, 0.05, 0.05);
    // }

    this.visualMesh.parent = this.colliderMesh; // Parent visual to the physics-controlled mesh
    this.visualMesh.position = initialWorldPosition.subtract(
      this.colliderMesh.getAbsolutePosition()
    );

    this.attackAnimationDurationSeconds = Spider.templateAttackAnimDuration;
  }

  /**
   * Sets a callback function to be invoked when the spider successfully damages the player.
   * @param callback The function to call, which receives the damage amount.
   */
  public setOnPlayerDamaged(callback: (damage: number) => void): void {
    this.onPlayerDamagedCallback = callback;
  }

  /**
   * Main update loop for the spider's AI, movement, and attack logic.
   * Called every frame from the game's render loop.
   * @param deltaTime The time in seconds since the last frame.
   * @param playerCamera The player's camera, used to determine player position.
   */
  public update(deltaTime: number, playerCamera: FreeCamera): void {
    if (
      this.currentHealth <= 0 ||
      this.isDying ||
      !this.physicsAggregate ||
      !this.physicsAggregate.transformNode ||
      !this.physicsAggregate.transformNode.isEnabled() ||
      !this.visualMesh
    ) {
      return;
    }

    const playerBodyNode = playerCamera.parent as TransformNode; // Player's physics body is camera's parent
    if (!playerBodyNode) return; // Should not happen if player is set up correctly
    const playerPosition = playerBodyNode.absolutePosition.clone();
    const myPosition = (
      this.physicsAggregate.transformNode as Mesh
    ).absolutePosition.clone();

    const directionToPlayerXZ = playerPosition.subtract(myPosition);
    directionToPlayerXZ.y = 0;
    const distanceToPlayer = directionToPlayerXZ.length();

    this.isCurrentlyAggro = false;

    let isMovingThisFrame = false;
    if (
      distanceToPlayer < this.aggroRadius &&
      distanceToPlayer > this.stoppingDistance
    ) {
      directionToPlayerXZ.normalize();
      // const moveVector = directionToPlayerXZ.scale(this.speed * deltaTime);
      // this.collider.moveWithCollisions(moveVector); // Old movement
      const targetVelocity = directionToPlayerXZ.scale(this.speed);
      this.physicsAggregate.body.setLinearVelocity(
        new Vector3(
          targetVelocity.x,
          this.physicsAggregate.body.getLinearVelocity().y,
          targetVelocity.z
        )
      );
      isMovingThisFrame = true;
      this.isCurrentlyAggro = true;
    }

    if (distanceToPlayer < this.aggroRadius) {
      // Ensure no other physics-based rotation is happening
      if (this.physicsAggregate.body) {
        this.physicsAggregate.body.setAngularVelocity(Vector3.Zero());
      }

      const lookAtTarget = new Vector3(
        playerPosition.x,
        myPosition.y, // Look at player's XZ, but maintain spider's Y
        playerPosition.z
      );

      // this.collider.lookAt(lookAtTarget, Math.PI); // Model might need Y-axis rotation offset
      (this.physicsAggregate.transformNode as Mesh).lookAt(
        lookAtTarget
        // Math.PI // Temporarily removed for testing
      );
      this.isCurrentlyAggro = true;
    }

    this.timeSinceLastAttack += deltaTime;

    if (distanceToPlayer <= this.stoppingDistance && this.isCurrentlyAggro) {
      if (
        this.timeSinceLastAttack >= this.attackCooldown &&
        !this.isCurrentlyAttacking
      ) {
        this.isCurrentlyAttacking = true;
        this.walkAnimation?.stop();
        this.idleAnimation?.stop();

        this.attackAnimation?.play(false);
        this.timeSinceLastAttack = 0;

        const damageDelayFactor = 0.6;
        const damageTiming =
          this.attackAnimationDurationSeconds * damageDelayFactor * 1000;

        setTimeout(() => {
          // Check if spider is still valid and conditions for damage are met
          if (
            this.currentHealth <= 0 ||
            this.isDying ||
            !this.physicsAggregate.transformNode ||
            !this.physicsAggregate.transformNode.isEnabled() ||
            !this.visualMesh
          ) {
            this.isCurrentlyAttacking = false; // Ensure flag is reset
            return;
          }
          // Damage applied only if spider is still trying to attack and player is in range
          // The isCurrentlyAttacking flag is more about initiating the animation and cooldown
          const finalPlayerPosition = (
            playerCamera.parent as TransformNode
          ).absolutePosition.clone();
          const finalMyPosition = (
            this.physicsAggregate.transformNode as Mesh
          ).absolutePosition.clone();
          const finalDistance = finalPlayerPosition
            .subtract(finalMyPosition)
            .length();

          if (finalDistance <= this.stoppingDistance + 0.75) {
            this.onPlayerDamagedCallback(this.attackDamage);
          }
          this.isCurrentlyAttacking = false; // Reset after attack attempt (damage or not)
        }, damageTiming);
      }
    }

    // Animation State Machine
    if (this.attackAnimation?.isPlaying) {
      // Let attack animation play out
    } else if (isMovingThisFrame) {
      this.idleAnimation?.stop();
      if (!this.walkAnimation?.isPlaying) {
        this.walkAnimation?.start(
          true,
          1.0,
          this.walkAnimation.from,
          this.walkAnimation.to,
          false
        );
      }
    } else {
      this.walkAnimation?.stop();
      if (!this.idleAnimation?.isPlaying) {
        this.idleAnimation?.start(
          true,
          1.0,
          this.idleAnimation.from,
          this.idleAnimation.to,
          false
        );
      }
    }
  }

  /**
   * Inflicts damage to the spider and handles its death if health drops to zero.
   * @param amount The amount of damage to inflict.
   */
  public takeDamage(amount: number): void {
    if (this.currentHealth <= 0 || this.isDying) {
      return;
    }

    this.currentHealth -= amount;

    // --- BLOOD SPLAT EFFECT ---
    const splat = new Sprite("blood_splat", Spider.bloodSplatManager);
    // Place at the center of the colliderMesh, slightly above ground
    const pos = this.colliderMesh.getAbsolutePosition().clone();
    pos.y += 0.05; // Avoid z-fighting
    splat.position = pos;
    splat.size = 0.5 + Math.random() * 0.2;
    splat.angle = Math.random() * Math.PI * 2; // Random rotation
    splat.isPickable = false;
    splat.invertU = Math.random() > 0.5;
    splat.invertV = Math.random() > 0.5;
    splat.color.a = 1;
    // Fade out and dispose after 0.7s
    setTimeout(() => {
      const fadeDuration = 300;
      const fadeStep = 30;
      let alpha = 1;
      const fade = () => {
        alpha -= fadeStep / fadeDuration;
        if (alpha <= 0) {
          splat.dispose();
          return;
        }
        splat.color.a = Math.max(0, alpha);
        setTimeout(fade, fadeStep);
      };
      fade();
    }, 700);
    // --- END BLOOD SPLAT ---
    if (this.currentHealth <= 0) {
      this.currentHealth = 0;
      this.die();
    }
  }

  /**
   * Handles the spider's death, playing a death animation and then cleaning up resources.
   */
  private die(): void {
    if (this.isDying) return;
    this.isDying = true;
    this.isCurrentlyAggro = false;
    this.isCurrentlyAttacking = false;

    this.walkAnimation?.stop();
    this.idleAnimation?.stop();
    this.attackAnimation?.stop();

    this.physicsAggregate?.dispose(); // Dispose of the physics body from the simulation

    const cleanupInstanceAnimations = () => {
      this.walkAnimation?.dispose();
      this.idleAnimation?.dispose();
      this.attackAnimation?.dispose();
      this.deathAnimation?.dispose();
      // @ts-ignore
      this.walkAnimation = null;
      // @ts-ignore
      this.idleAnimation = null;
      // @ts-ignore
      this.attackAnimation = null;
      // @ts-ignore
      this.deathAnimation = null;
    };

    if (this.deathAnimation) {
      this.deathAnimation.play(false); // Play once
      // Use a local reference for the observable in case 'this' changes context or dispose is called early
      const deathAnimObservable =
        this.deathAnimation.onAnimationEndObservable.addOnce(() => {
          cleanupInstanceAnimations();
        });
      if (!deathAnimObservable && this.deathAnimation.isPlaying === false) {
        // Safety for non-looping anim that might not fire if already at end
        cleanupInstanceAnimations();
      }
    } else {
      cleanupInstanceAnimations();
    }
  }

  /**
   * Disposes of the spider's visual and collider meshes from the scene.
   * Also disposes of cloned animation groups associated with this instance.
   */
  private disposeMeshes(): void {
    // Dispose visual mesh and its children. Do not dispose shared materials.
    this.visualMesh?.dispose(false, false);
    // this.collider?.dispose(); // The collider mesh (transformNode) should be disposed if physicsAggregate.dispose() doesn't
    // It's often safer to dispose the mesh explicitly after the aggregate if it wasn't created by the aggregate itself.
    // However, PhysicsAggregate dispose typically does not dispose the TransformNode.
    (this.physicsAggregate?.transformNode as Mesh)?.dispose();

    // Dispose cloned animation groups for this instance
    this.walkAnimation?.dispose();
    this.idleAnimation?.dispose();
    this.attackAnimation?.dispose();
    this.deathAnimation?.dispose();

    // @ts-ignore
    this.visualMesh = null;
    // @ts-ignore
    // this.collider = null;
    this.colliderMesh = null; // Clear the reference
    // @ts-ignore
    this.physicsAggregate = null; // Clear the reference
  }

  /**
   * Checks if the spider is currently aggroed towards the player.
   * @returns True if the spider is alive and aggroed, false otherwise.
   */
  public getIsAggro(): boolean {
    return this.currentHealth > 0 && !this.isDying && this.isCurrentlyAggro;
  }

  /**
   * Checks if the spider is currently in the process of dying (e.g., death animation playing).
   * @returns True if the spider is dying, false otherwise.
   */
  public getIsDying(): boolean {
    return this.isDying;
  }

  /**
   * Public method for explicit cleanup of the spider from the game.
   * Ensures that death processes are triggered if the spider is still alive and not already dying.
   * If already dead but meshes not disposed (e.g. interrupted death anim), disposes meshes.
   */
  public dispose(): void {
    if (this.currentHealth > 0 && !this.isDying) {
      this.die();
    } else if (this.currentHealth <= 0 && !this.isDying) {
      // This case handles when the spider is marked as having no health,
      // but the formal 'die()' process hasn't been initiated.
      // Here, a full cleanup including meshes is performed.
      this.disposeMeshes();
    }
    // If isDying is true, it means die() has been called.
    // The die() method now handles preserving the mesh and cleaning up animations and physics.
    // So, no further action is needed here for that case.
  }
}
