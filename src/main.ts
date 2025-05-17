import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Meshes/Builders/sphereBuilder"; // For MeshBuilder.CreateSphere
import "@babylonjs/core/Meshes/Builders/groundBuilder"; // For MeshBuilder.CreateGround

// Get the canvas element
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

// Create a Babylon.js engine
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false, // Enable WebGL2 if available
});

// Create a scene
const scene = new Scene(engine);

// Create a camera
const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

// Create a light
const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

// Create a sphere
const sphere = MeshBuilder.CreateSphere(
  "sphere1",
  { diameter: 2, segments: 16 },
  scene
);
sphere.position.y = 1;

// Create a ground plane
MeshBuilder.CreateGround(
  "ground1",
  { width: 10, height: 10, subdivisions: 2 },
  scene
);

// Render loop
engine.runRenderLoop(() => {
  scene.render();
});

// Handle window resize
window.addEventListener("resize", () => {
  engine.resize();
});
