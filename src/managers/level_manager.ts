import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import * as config from "../config";
import { EntityFactory } from "../ecs/entity_factory";
import { ClosedChest } from "../interactables";

export class LevelManager {
  private wallPositions: [number, number, number, number][] = [];

  constructor(private scene: Scene, private entityFactory: EntityFactory) {
    this.wallPositions = [
      [
        0,
        config.WORLD_CONFIG.GROUND_SIZE / 2,
        config.WORLD_CONFIG.GROUND_SIZE,
        config.WORLD_CONFIG.WALL_THICKNESS,
      ],
      [
        0,
        -config.WORLD_CONFIG.GROUND_SIZE / 2,
        config.WORLD_CONFIG.GROUND_SIZE,
        config.WORLD_CONFIG.WALL_THICKNESS,
      ],
      [
        -config.WORLD_CONFIG.GROUND_SIZE / 2,
        0,
        config.WORLD_CONFIG.WALL_THICKNESS,
        config.WORLD_CONFIG.GROUND_SIZE,
      ],
      [
        config.WORLD_CONFIG.GROUND_SIZE / 2,
        0,
        config.WORLD_CONFIG.WALL_THICKNESS,
        config.WORLD_CONFIG.GROUND_SIZE,
      ],
    ];
  }

  public async initialize(): Promise<void> {
    this.createGround();
    this.createWalls();
    await this.loadLevelAssets();
  }

  private createGround() {
    const ground = MeshBuilder.CreateGround(
      "ground1",
      {
        width: config.WORLD_CONFIG.GROUND_SIZE,
        height: config.WORLD_CONFIG.GROUND_SIZE,
        subdivisions: 2,
      },
      this.scene
    );
    const groundMaterial = new StandardMaterial("groundMaterial", this.scene);
    groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
    const sandTexture = new Texture(
      config.ASSET_PATHS.SAND_TEXTURE,
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
        friction: config.PHYSICS_CONFIG.GROUND_FRICTION,
        restitution: config.PHYSICS_CONFIG.GROUND_RESTITUTION,
      },
      this.scene
    );
  }

  private createWalls() {
    const wallHeight = config.WORLD_CONFIG.WALL_HEIGHT;
    this.wallPositions.forEach((props, i) => {
      const wall = MeshBuilder.CreateBox(
        `wall${i + 1}`,
        { width: props[2], height: wallHeight, depth: props[3] },
        this.scene
      );
      wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
      // wall.isVisible = false; // Should be controlled by debug or config
      wall.checkCollisions = true;
      new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          friction: config.PHYSICS_CONFIG.WALL_FRICTION,
          restitution: config.PHYSICS_CONFIG.WALL_RESTITUTION,
        },
        this.scene
      );
    });
  }

  private async loadLevelAssets() {
    // Spiders via ECS Factory
    await this.entityFactory.createSpider(new Vector3(20, 0, 20));

    // Palm trees
    await this.loadAssetWithCollider(
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
    await this.loadAssetWithCollider(
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
    await this.loadAssetWithCollider(
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
    await this.loadAssetWithCollider(
      "chestClosed",
      "PIRATE_KIT_MODELS",
      "CHEST_CLOSED_GLB",
      new Vector3(18, 0, 18),
      new Vector3(1, 1, 1),
      false,
      (collider) => {
        new ClosedChest(collider as Mesh, true, "key_old_chest", () => {
          // Interaction system handles crosshair, this handles logic for now
        });
      },
      2.25,
      2.25,
      2.25
    );
  }

  private async loadAssetWithCollider(
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
        config.ASSET_PATHS[filePathKey],
        config.ASSET_PATHS[fileNameKey],
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

      // collider.isVisible = false; // Debug mode controlled elsewhere?
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
}

