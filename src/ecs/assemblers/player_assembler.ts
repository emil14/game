import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { world } from "../world";
import { PhysicsRegistry } from "../physics_registry";
import { PLAYER_CONFIG } from "../../config";

export class PlayerAssembler {
  constructor(private scene: Scene, private camera: UniversalCamera) {}

  public async create(): Promise<void> {
    const playerStartPos = new Vector3(0, 1.0, -5);
    
    // 1. Create Mesh
    const playerBodyMesh = MeshBuilder.CreateCapsule(
      "playerBody",
      {
        radius: PLAYER_CONFIG.PLAYER_RADIUS,
        height: PLAYER_CONFIG.PLAYER_HEIGHT,
        tessellation: 20,
      },
      this.scene
    );
    playerBodyMesh.position = playerStartPos.clone();
    playerBodyMesh.position.y = playerStartPos.y + PLAYER_CONFIG.PLAYER_HEIGHT / 2;
    playerBodyMesh.isVisible = false; // Usually hidden, debug mode handles visibility elsewhere or we can toggle
    // Note: Original code had isVisible = isDebugModeEnabled. 
    // We'll leave it invisible by default or handle via debug system later.
    
    playerBodyMesh.checkCollisions = true;
    playerBodyMesh.ellipsoid = new Vector3(
        PLAYER_CONFIG.PLAYER_RADIUS,
        PLAYER_CONFIG.PLAYER_HEIGHT / 2,
        PLAYER_CONFIG.PLAYER_RADIUS
    );
    playerBodyMesh.ellipsoidOffset = new Vector3(0, 0, 0);

    // 2. Setup Camera
    this.camera.parent = playerBodyMesh;
    this.camera.position = new Vector3(
      0,
      PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET,
      0
    );

    // 3. Physics
    const playerAggregate = new PhysicsAggregate(
        playerBodyMesh,
        PhysicsShapeType.CAPSULE,
        {
            mass: 1.0,
            friction: 0.0,
            restitution: 0.0,
        },
        this.scene
    );
    playerAggregate.body.setMassProperties({
        inertia: new Vector3(0, 0, 0) // Lock rotation
    });

    // 4. Create Entity
    const playerEntity = world.add({
      transform: { mesh: playerBodyMesh },
      physics: { aggregate: playerAggregate },
      health: { 
        current: PLAYER_CONFIG.MAX_HEALTH, 
        max: PLAYER_CONFIG.MAX_HEALTH 
      },
      input: {
        moveDir: new Vector3(0, 0, 0),
        isJumping: false,
        isCrouching: false,
        isSprinting: false,
        isAttacking: false
      },
      sensor: {
          checkRange: 50.0,
          hitDistance: Infinity
      },
      stamina: {
        current: PLAYER_CONFIG.MAX_STAMINA,
        max: PLAYER_CONFIG.MAX_STAMINA,
        regenRate: PLAYER_CONFIG.STAMINA_REGENERATION_RATE,
        depletionRate: PLAYER_CONFIG.STAMINA_DEPLETION_RATE
      },
      player: { 
          id: "p1", 
          camera: this.camera,
      } 
    });

    PhysicsRegistry.register(playerAggregate, playerEntity);
  }
}

