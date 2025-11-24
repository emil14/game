import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate, PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import * as YUKA from "yuka";
import { world } from "../world";
import { PhysicsRegistry } from "../physics_registry";

export class SpiderAssembler {
  private static templateRootMesh: AbstractMesh | null = null;
  private static templateAnimationGroups: AnimationGroup[] = [];
  private static templateAttackAnimDuration: number = 0.75;
  private static assetsLoadingPromise: Promise<void> | null = null;

  constructor(private scene: Scene, private entityManager: YUKA.EntityManager) {}

  public async loadAssets(): Promise<void> {
    if (SpiderAssembler.assetsLoadingPromise) {
      return SpiderAssembler.assetsLoadingPromise;
    }

    console.log("SpiderAssembler: Starting to load assets...");
    SpiderAssembler.assetsLoadingPromise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          null,
          "assets/models/enemies/",
          "spider.glb",
          this.scene
        );

        console.log("SpiderAssembler: Assets loaded.", result.meshes.length, "meshes");

        SpiderAssembler.templateRootMesh = result.meshes[0];
        SpiderAssembler.templateRootMesh.name = "spiderTemplateRoot";
        SpiderAssembler.templateRootMesh.setEnabled(false);

        SpiderAssembler.templateAnimationGroups = result.animationGroups;
        SpiderAssembler.templateAnimationGroups.forEach((ag) => {
          ag.stop();
        });

        const attackAnimTemplate = SpiderAssembler.templateAnimationGroups.find(
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
              SpiderAssembler.templateAttackAnimDuration = numFrames / frameRate;
            }
          }
        }
      } catch (error) {
        console.error("Failed to load spider template assets:", error);
        SpiderAssembler.assetsLoadingPromise = null;
        throw error;
      }
    })();
    return SpiderAssembler.assetsLoadingPromise;
  }

  public async create(initialPosition: Vector3): Promise<void> {
    await this.loadAssets();

    if (!SpiderAssembler.templateRootMesh) {
      throw new Error("Spider assets not loaded");
    }

    const uniqueId = Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    // 1. Visual Mesh
    const visualMesh = SpiderAssembler.templateRootMesh.clone(
      "spiderVisual_" + uniqueId,
      null,
      false
    )!;
    visualMesh.setEnabled(true);
    
    // FIX: Multiply existing scale instead of overwriting (preserves import scale)
    visualMesh.scaling.multiplyInPlace(new Vector3(0.5, 0.5, 0.5));
    
    visualMesh.checkCollisions = false;
    visualMesh.getChildMeshes().forEach((m) => {
      m.checkCollisions = false;
    });

    // 2. Animations
    let walkAnimation: AnimationGroup | null = null;
    let idleAnimation: AnimationGroup | null = null;
    let attackAnimation: AnimationGroup | null = null;
    let deathAnimation: AnimationGroup | null = null;

    SpiderAssembler.templateAnimationGroups.forEach((templateAg) => {
      const clonedAg = templateAg.clone(
        templateAg.name + "_clone_" + uniqueId,
        (oldTarget: any) => {
           if (oldTarget === SpiderAssembler.templateRootMesh) return visualMesh;
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
    
    const width = Math.max(0.5, dimensions.x);
    const height = Math.max(0.5, dimensions.y);
    const depth = Math.max(0.5, dimensions.z);

    const colliderMesh = MeshBuilder.CreateBox(
      "spiderCollider_" + uniqueId,
      { width, height, depth },
      this.scene
    );
    colliderMesh.isVisible = false; 
    colliderMesh.checkCollisions = true;
    
    const spawnPos = initialPosition.clone();
    spawnPos.y += 2.0; 

    colliderMesh.position = spawnPos.add(new Vector3(0, height / 2, 0));
    
    visualMesh.parent = colliderMesh;
    visualMesh.position = new Vector3(0, -height / 2, 0);
    visualMesh.rotationQuaternion = null;
    visualMesh.rotation = Vector3.Zero();

    const physicsAggregate = new PhysicsAggregate(
      colliderMesh,
      PhysicsShapeType.BOX,
      { 
          mass: 10, 
          friction: 0.0, 
          restitution: 0.0 
      },
      this.scene
    );
    physicsAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
    physicsAggregate.body.setMassProperties({
        inertia: new Vector3(0, 0, 0), // Lock rotation
    });

    // 4. Yuka AI
    const vehicle = new YUKA.Vehicle();
    vehicle.maxSpeed = 3.0; 
    vehicle.position.set(colliderMesh.position.x, colliderMesh.position.y, colliderMesh.position.z);
    
    const wanderBehavior = new YUKA.WanderBehavior();
    const seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
    
    // Default to Wander
    vehicle.steering.add(wanderBehavior);
    // Seek is added but effectively disabled by not being in steering or handled by system
    // But here we'll just keep instances ready and let System manage the steering list
    
    this.entityManager.add(vehicle);

    // 5. ECS Entity Assembly
    const entityId = `spider_${uniqueId}`;
    
    colliderMesh.metadata = { 
        enemyType: "spider", 
        entityId: entityId 
    };

    const entity = world.add({
      enemy: { type: "spider" },
      transform: { mesh: colliderMesh }, 
      visual: { 
          mesh: visualMesh, 
          rotationOffset: new Vector3(0, Math.PI, 0) 
      },
      health: { current: 50, max: 50 },
      combat: { 
          damage: 10, 
          cooldown: 1.5, 
          lastAttackTime: 0, 
          range: 2.5,
          attackDuration: SpiderAssembler.templateAttackAnimDuration 
      },
      physics: { aggregate: physicsAggregate },
      yuka: { 
        vehicle: vehicle,
        behaviors: {
          seek: seekBehavior,
          wander: wanderBehavior
        }
      },
      animations: {
          idle: idleAnimation,
          walk: walkAnimation,
          attack: attackAnimation,
          death: deathAnimation,
          current: idleAnimation
      },
      ai: { state: "idle" },
      movement: {
        velocity: new Vector3(0, 0, 0)
      }
    });

    PhysicsRegistry.register(physicsAggregate, entity);
  }
}
