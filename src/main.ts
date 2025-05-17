console.log("main.ts executing..."); // DBG
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color"; // Import Color4
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder"; // For MeshBuilder.CreateSphere
import "@babylonjs/core/Meshes/Builders/groundBuilder"; // For MeshBuilder.CreateGround
import "@babylonjs/core/Collisions/collisionCoordinator"; // Needed for collisions
import "@babylonjs/inspector"; // Import the inspector

// Get the canvas element
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const fpsDisplay = document.getElementById("fpsDisplay") as HTMLElement; // Get FPS display element

// Create a Babylon.js engine
const engine = new Engine(canvas, false, {
  // Set antialias to false
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false, // Enable WebGL2 if available
});

// Create a scene
const scene = new Scene(engine);
// scene.clearColor = new Color4(0.2, 0.3, 0.5, 1.0); // Remove debug clear color, default is fine now

// Show the inspector
// scene.debugLayer.show({
//   embedMode: true,
// });

// Create a camera
const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene); // Restore FPS camera position
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

// Configure camera for first-person movement
camera.ellipsoid = new Vector3(0.5, 0.8, 0.5);
camera.checkCollisions = true;
camera.applyGravity = true;
camera.speed = 2.0; // Balanced base speed for light running
const defaultSpeed = camera.speed;
const runSpeedMultiplier = 2.0; // Sprint will be twice the base speed
camera.angularSensibility = 2000;
camera.inertia = 0; // Set inertia to 0 for sharp mouse movement

// WASD controls
camera.keysUp.push(87); // W
camera.keysDown.push(83); // S
camera.keysLeft.push(65); // A
camera.keysRight.push(68); // D

// Jerk/Roll mechanics
const jerkDistance = 2.0; // Distance of the jerk/roll
const doubleTapInterval = 300; // ms
let lastKeyPressTime: { [key: number]: number } = {};
let isJerking = false;
const jerkCooldown = 0; // ms
let lastJerkTime = 0;
const jerkDuration = 150; // ms - How long the jerk animation should take
let jerkStartTime = 0;
let jerkStartPosition: Vector3 | null = null;
let jerkTargetPosition: Vector3 | null = null;

// Lock mouse pointer on click for FPS controls
scene.onPointerDown = (evt) => {
  if (evt.button === 0) {
    // Left mouse button
    engine.enterPointerlock();
  }
};

scene.onPointerUp = (evt) => {
  if (evt.button === 0) {
    // Left mouse button
    engine.exitPointerlock();
  }
};

// Sprinting with Shift key
let isSprinting = false;
window.addEventListener("keydown", (event) => {
  const now = Date.now();
  if (
    !isJerking &&
    now - lastJerkTime > jerkCooldown &&
    lastKeyPressTime[event.keyCode] &&
    now - lastKeyPressTime[event.keyCode] < doubleTapInterval
  ) {
    // Double tap detected
    isJerking = true;
    lastJerkTime = now;
    const direction = new Vector3(0, 0, 0);
    switch (event.keyCode) {
      case 87: // W (forward)
        direction.z = jerkDistance;
        break;
      case 83: // S (backward)
        direction.z = -jerkDistance;
        break;
      case 65: // A (left)
        direction.x = -jerkDistance;
        break;
      case 68: // D (right)
        direction.x = jerkDistance;
        break;
    }

    // Apply jerk relative to camera's local space
    const forward = new Vector3(
      Math.sin(camera.rotation.y),
      0,
      Math.cos(camera.rotation.y)
    );
    const right = new Vector3(
      Math.sin(camera.rotation.y + Math.PI / 2),
      0,
      Math.cos(camera.rotation.y + Math.PI / 2)
    );
    const moveDirection = new Vector3(0, 0, 0);

    if (event.keyCode === 87) {
      // W
      moveDirection.addInPlace(forward.scale(jerkDistance));
    } else if (event.keyCode === 83) {
      // S
      moveDirection.addInPlace(forward.scale(-jerkDistance));
    } else if (event.keyCode === 65) {
      // A
      moveDirection.addInPlace(right.scale(-jerkDistance));
    } else if (event.keyCode === 68) {
      // D
      moveDirection.addInPlace(right.scale(jerkDistance));
    }

    // Store original gravity and temporarily disable it for the jerk
    // const originalGravity = scene.gravity; // We'll handle this in the animation loop
    // const originalApplyGravity = camera.applyGravity; // We'll handle this in the animation loop
    camera.applyGravity = false;
    // scene.gravity = new Vector3(0,0,0); // Setting scene.gravity might affect other elements, better to just disable for camera.

    jerkStartPosition = camera.position.clone();
    jerkTargetPosition = camera.position.add(moveDirection);
    jerkStartTime = Date.now();

    // camera.position.addInPlace(moveDirection); // Remove direct position update

    // Restore gravity after a short delay to allow the jerk to complete
    // setTimeout(() => {
    //   camera.applyGravity = originalApplyGravity;
    //   scene.gravity = originalGravity;
    //   isJerking = false;
    // }, 100); // Short duration for the jerk movement itself
  } else {
    lastKeyPressTime[event.keyCode] = now;
  }

  if (event.keyCode === 16 && !isSprinting) {
    // Shift key
    isSprinting = true;
    camera.speed = defaultSpeed * runSpeedMultiplier;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.keyCode === 16) {
    // Shift key
    isSprinting = false;
    camera.speed = defaultSpeed;
  }
});

// Create a light
const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

// Create a sphere
const sphere = MeshBuilder.CreateSphere(
  "sphere1",
  { diameter: 2, segments: 16 },
  scene
);
sphere.position = new Vector3(0, 1, 0); // Restore sphere position

// Create a ground plane
const ground = MeshBuilder.CreateGround(
  "ground1",
  { width: 50, height: 50, subdivisions: 2 }, // Made ground larger
  scene
);
ground.checkCollisions = true; // Enable collisions for the ground

// Render loop
engine.runRenderLoop(() => {
  const now = Date.now();
  if (isJerking && jerkStartPosition && jerkTargetPosition) {
    const elapsed = now - jerkStartTime;
    const progress = Math.min(elapsed / jerkDuration, 1);

    camera.position = Vector3.Lerp(
      jerkStartPosition,
      jerkTargetPosition,
      progress
    );

    if (progress >= 1) {
      isJerking = false;
      jerkStartPosition = null;
      jerkTargetPosition = null;
      camera.applyGravity = true; // Restore gravity
    }
  }

  // console.log("Render loop running..."); // DBG - Remove this log
  scene.render();
  if (fpsDisplay) {
    fpsDisplay.textContent = "FPS: " + engine.getFps().toFixed(); // Update FPS display
  }
});

// Handle window resize
window.addEventListener("resize", () => {
  engine.resize();
});
