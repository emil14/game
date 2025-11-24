import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Camera } from "@babylonjs/core/Cameras/camera";

export class CharacterController {
  private mesh: AbstractMesh;
  private camera: Camera;
  private scene: Scene;

  // Configuration
  private walkSpeed: number = 3;
  private runSpeed: number = 6;
  private jumpForce: number = 2; // Jump initial velocity
  private gravity: number = 9.81;

  // State
  private velocity: Vector3 = Vector3.Zero();
  private isFalling: boolean = false;
  
  // Input Flags
  private _isWalking: boolean = false;
  private _isWalkingBack: boolean = false;
  private _isStrafingLeft: boolean = false;
  private _isStrafingRight: boolean = false;
  private _isRunning: boolean = false;
  
  private moveDirection: Vector3 = Vector3.Zero(); // New Vector Input

  constructor(mesh: AbstractMesh, camera: Camera, scene: Scene) {
    this.mesh = mesh;
    this.camera = camera;
    this.scene = scene;
    
    // Register update loop
    this.scene.onBeforeRenderObservable.add(() => {
        this.update();
    });
  }

  // --- API Methods matching babylonjs-charactercontroller usage ---

  public setFaceForward(_b: boolean) { /* No-op for FPS usually */ }
  public setMode(_n: number) { /* No-op */ }
  public setTurnSpeed(_n: number) { /* No-op, camera handles turning */ }
  public setCameraElasticity(_b: boolean) { /* No-op */ }
  public setCameraTarget(_v: Vector3) { /* No-op */ }
  public enableKeyBoard(_b: boolean) { /* No-op */ }

  public setWalkSpeed(n: number) { this.walkSpeed = n; }
  public setRunSpeed(n: number) { this.runSpeed = n; }
  public setJumpSpeed(n: number) { this.jumpForce = n; }

  public walk(b: boolean) { this._isWalking = b; }
  public walkBack(b: boolean) { this._isWalkingBack = b; }
  public strafeLeft(b: boolean) { this._isStrafingLeft = b; }
  public strafeRight(b: boolean) { this._isStrafingRight = b; }
  public run(b: boolean) { this._isRunning = b; }

  public jump() {
    if (this.isGrounded()) {
      this.velocity.y = this.jumpForce;
      this.isFalling = true; // Technically we are now in air
    }
  }
  
  public stop() {
      this._isWalking = false;
      this._isWalkingBack = false;
      this._isStrafingLeft = false;
      this._isStrafingRight = false;
      this.velocity = Vector3.Zero();
  }

  public isGrounded(): boolean {
    return !this.isFalling && this.checkGround();
  }

  // --- Internal Logic ---

  private checkGround(): boolean {
      // Raycast from slightly above the bottom of the mesh
      const bounds = this.mesh.getBoundingInfo().boundingBox;
      // extendSize is half-extents. height/2.
      const halfHeight = bounds.extendSize.y;
      
      // Start ray 0.1 units above the bottom
      const rayOrigin = this.mesh.position.clone();
      rayOrigin.y -= (halfHeight - 0.1);
      
      const ray = new Ray(rayOrigin, Vector3.Down(), 0.2);
      const pick = this.scene.pickWithRay(ray, (m) => m.isPickable && m.checkCollisions && m !== this.mesh);
      return pick?.hit || false;
  }

  public setMoveDirection(direction: Vector3) {
      this.moveDirection.copyFrom(direction);
  }

  private update() {
    const dt = this.scene.getEngine().getDeltaTime() / 1000;

    // 1. Calculate input velocity
    let moveDir = this.moveDirection.clone(); // Use the vector from ECS directly
    
    // Legacy support (OR logic)
    const cameraForward = this.camera.getDirection(Vector3.Forward());
    const cameraRight = this.camera.getDirection(Vector3.Right());
    cameraForward.y = 0;
    cameraRight.y = 0;
    cameraForward.normalize();
    cameraRight.normalize();

    // If legacy flags are set, they override/add to the vector (for now)
    if (this._isWalking) moveDir.addInPlace(cameraForward);
    if (this._isWalkingBack) moveDir.subtractInPlace(cameraForward);
    if (this._isStrafingRight) moveDir.addInPlace(cameraRight);
    if (this._isStrafingLeft) moveDir.subtractInPlace(cameraRight);

    if (moveDir.lengthSquared() > 0) {
      moveDir.normalize();
      const speed = this._isRunning ? this.runSpeed : this.walkSpeed;
      moveDir.scaleInPlace(speed);
    }
    
    // Debug output (once per second roughly)
    if (Math.random() < 0.01) {
        console.log("CC Update:", {
            dt,
            pos: this.mesh.position.toString(),
            moveDir: moveDir.toString(),
            velY: this.velocity.y,
            grounded: this.checkGround()
        });
    }

    // 2. Apply Gravity
    const grounded = this.checkGround();
    if (grounded && this.velocity.y <= 0) {
        // On ground and not jumping
        this.velocity.y = -0.5; // Small stick force
        this.isFalling = false;
    } else {
        // In air OR jumping
        this.velocity.y -= this.gravity * dt;
        this.isFalling = true;
    }

    // 3. Combine
    const frameMove = moveDir.scale(dt);
    frameMove.y = this.velocity.y * dt;

    // 4. Move
    this.mesh.moveWithCollisions(frameMove);
  }
}

