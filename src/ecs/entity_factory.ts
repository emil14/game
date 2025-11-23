import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import * as YUKA from "yuka";
import { world } from "./world";

export class EntityFactory {
  private static templateRootMesh: AbstractMesh | null = null;
  private static templateAnimationGroups: AnimationGroup[] = [];
  private static templateAttackAnimDuration: number = 0.75;
  private static assetsLoadingPromise: Promise<void> | null = null;

  private scene: Scene;
  private entityManager: YUKA.EntityManager;

  constructor(scene: Scene, entityManager: YUKA.EntityManager) {
    this.scene = scene;
    this.entityManager = entityManager;
  }

  public async loadSpiderAssets(): Promise<void> {
    if (EntityFactory.assetsLoadingPromise) {
      return EntityFactory.assetsLoadingPromise;
    }

    EntityFactory.assetsLoadingPromise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          null,
          "assets/models/enemies/",
          "spider.glb",
          this.scene
        );

        EntityFactory.templateRootMesh = result.meshes[0];
        EntityFactory.templateRootMesh.name = "spiderTemplateRoot";
        EntityFactory.templateRootMesh.setEnabled(false);

        EntityFactory.templateAnimationGroups = result.animationGroups;
        EntityFactory.templateAnimationGroups.forEach((ag) => {
          ag.stop();
        });

        const attackAnimTemplate = EntityFactory.templateAnimationGroups.find(
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
              EntityFactory.templateAttackAnimDuration = numFrames / frameRate;
            }
          }
        }
      } catch (error) {
        console.error("Failed to load spider template assets:", error);
        EntityFactory.assetsLoadingPromise = null;
        throw error;
      }
    })();
    return EntityFactory.assetsLoadingPromise;
  }

  public async createSpider(initialPosition: Vector3): Promise<void> {
    await this.loadSpiderAssets();

    if (!EntityFactory.templateRootMesh) {
      throw new Error("Spider assets not loaded");
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    // 1. Visual Mesh
    const visualMesh = EntityFactory.templateRootMesh.clone(
      "spiderVisual_" + uniqueId,
      null,
      false
    )!;
    visualMesh.setEnabled(true);
    visualMesh.scaling = new Vector3(0.5, 0.5, 0.5);
    visualMesh.checkCollisions = false;
    visualMesh.getChildMeshes().forEach((m) => {
      m.checkCollisions = false;
    });

    // 2. Animations
    let walkAnimation: AnimationGroup | null = null;
    let idleAnimation: AnimationGroup | null = null;
    let attackAnimation: AnimationGroup | null = null;
    let deathAnimation: AnimationGroup | null = null;

    EntityFactory.templateAnimationGroups.forEach((templateAg) => {
      const clonedAg = templateAg.clone(
        templateAg.name + "_clone_" + uniqueId,
        (oldTarget: any) => {
           if (oldTarget === EntityFactory.templateRootMesh) return visualMesh;
           if (oldTarget.name) {
             const newTarget = visualMesh.getScene().getTransformNodeByName(oldTarget.name) || 
                               visualMesh.getScene().getMeshByName(oldTarget.name);
             if (newTarget) return newTarget;
           }
           return oldTarget;
        }
      );
      if (clonedAg) {
        clonedAg.reset();
        clonedAg.stop();
        if (templateAg.name.includes("Walk")) walkAnimation = clonedAg;
        if (templateAg.name.includes("Idle")) idleAnimation = clonedAg;
        if (templateAg.name.includes("Attack")) attackAnimation = clonedAg;
        if (templateAg.name.includes("Death")) deathAnimation = clonedAg;
      }
    });

    // 3. Collider & Physics
    visualMesh.computeWorldMatrix(true);
    const boundingInfo = visualMesh.getHierarchyBoundingVectors(true);
    const dimensions = boundingInfo.max.subtract(boundingInfo.min);

    const colliderMesh = MeshBuilder.CreateBox(
      "spiderCollider_" + uniqueId,
      {
        width: Math.max(0.1, dimensions.x),
        height: Math.max(0.1, dimensions.y),
        depth: Math.max(0.1, dimensions.z),
      },
      this.scene
    );
    colliderMesh.isVisible = false;
    colliderMesh.position = boundingInfo.min.add(dimensions.scale(0.5));
    // Apply initial position offset
    const offset = colliderMesh.position.clone();
    colliderMesh.position = initialPosition.clone();
    
    // Parent visual to collider
    visualMesh.parent = colliderMesh;
    visualMesh.position = offset.scale(-1); // Center visual relative to collider

    const physicsAggregate = new PhysicsAggregate(
      colliderMesh,
      PhysicsShapeType.BOX,
      { mass: 1, friction: 0.5, restitution: 0.2 },
      this.scene
    );
    physicsAggregate.body.setMassProperties({
        inertia: new Vector3(0, 0, 0),
    });

    // 4. Yuka AI
    const vehicle = new YUKA.Vehicle();
    vehicle.maxSpeed = 3.0; // Default speed
    vehicle.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    
    // Add behaviors later in the system or here
    const wanderBehavior = new YUKA.WanderBehavior();
    vehicle.steering.add(wanderBehavior);
    this.entityManager.add(vehicle);

    // 5. ECS Entity Assembly
    const entityId = `spider_${uniqueId}`;
    
    // Tag metadata for Raycasting/UI (The "Metadata Leak" fix comes later)
    colliderMesh.metadata = { 
        enemyType: "spider", 
        entityId: entityId // Store ID instead of class instance
    };

    world.add({
      enemy: { type: "spider", isAggro: false },
      transform: { mesh: colliderMesh }, // The physics root
      health: { current: 50, max: 50 },
      combat: { 
          damage: 10, 
          cooldown: 1.5, 
          lastAttackTime: 0, 
          range: 2.5,
          attackDuration: EntityFactory.templateAttackAnimDuration 
      },
      physics: { aggregate: physicsAggregate },
      yuka: { vehicle: vehicle },
      animations: {
          idle: idleAnimation,
          walk: walkAnimation,
          attack: attackAnimation,
          death: deathAnimation,
          current: idleAnimation
      },
      ai: { state: "idle" }
    });
  }
}

