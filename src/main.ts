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
camera.speed = 2.0; // Explicitly set base speed before reading it into defaultSpeed
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
const jerkDistance = 3.0; // Distance of the jerk/roll
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
  const keyCode = event.keyCode;

  // Sprint state update
  if (keyCode === 16) {
    // Shift key
    if (!isSprinting) {
      isSprinting = true;
      if (!isJerking) {
        // Only update speed if not jerking
        camera.speed = defaultSpeed * runSpeedMultiplier;
      }
    }
  }

  // Jerk logic for WASD
  if ([87, 83, 65, 68].includes(keyCode)) {
    // W, S, A, D
    const previousPressTime = lastKeyPressTime[keyCode];
    lastKeyPressTime[keyCode] = now; // Always update for these keys for next check

    if (
      !isJerking && // Not already jerking
      now - lastJerkTime > jerkCooldown && // Cooldown met
      previousPressTime &&
      now - previousPressTime < doubleTapInterval // Double tap
    ) {
      // Double tap detected
      isJerking = true;
      lastJerkTime = now; // Record time of this jerk start for cooldown

      camera.speed = 0; // Temporarily disable normal movement input
      camera.applyGravity = false;

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
      const moveDirection = Vector3.Zero();

      if (keyCode === 87) {
        // W
        moveDirection.addInPlace(forward.scale(jerkDistance));
      } else if (keyCode === 83) {
        // S
        moveDirection.addInPlace(forward.scale(-jerkDistance));
      } else if (keyCode === 65) {
        // A
        moveDirection.addInPlace(right.scale(-jerkDistance));
      } else if (keyCode === 68) {
        // D
        moveDirection.addInPlace(right.scale(jerkDistance));
      }

      jerkStartPosition = camera.position.clone();
      jerkTargetPosition = camera.position.add(moveDirection);
      jerkStartTime = now;
    }
  }

  // Original sprint logic was here, now integrated above and in keyup
  // if (event.keyCode === 16 && !isSprinting) { ... }
});

window.addEventListener("keyup", (event) => {
  const keyCode = event.keyCode;
  if (keyCode === 16) {
    // Shift key
    if (isSprinting) {
      isSprinting = false;
      if (!isJerking) {
        // Only update speed if not jerking
        camera.speed = defaultSpeed;
      }
    }
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

      // Restore camera speed based on current sprint state
      if (isSprinting) {
        camera.speed = defaultSpeed * runSpeedMultiplier;
      } else {
        camera.speed = defaultSpeed;
      }
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
