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
