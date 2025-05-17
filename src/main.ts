import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SkyMaterial } from "@babylonjs/materials/sky";
import { WaterMaterial } from "@babylonjs/materials/water";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const fpsDisplay = document.getElementById("fpsDisplay") as HTMLElement;

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});

const scene = new Scene(engine);

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

camera.ellipsoid = new Vector3(0.5, 0.8, 0.5);
camera.checkCollisions = true;
camera.applyGravity = true;
camera.speed = 2.0;
const defaultSpeed = camera.speed;
const runSpeedMultiplier = 2.0;
camera.angularSensibility = 2000;
camera.inertia = 0;

camera.keysUp.push(87);
camera.keysDown.push(83);
camera.keysLeft.push(65);
camera.keysRight.push(68);

scene.onPointerDown = (evt) => {
  if (evt.button === 0) {
    engine.enterPointerlock();
  }
};

scene.onPointerUp = (evt) => {
  if (evt.button === 0) {
    engine.exitPointerlock();
  }
};

let isSprinting = false;
window.addEventListener("keydown", (event) => {
  const keyCode = event.keyCode;

  if (keyCode === 16) {
    if (!isSprinting) {
      isSprinting = true;
      camera.speed = defaultSpeed * runSpeedMultiplier;
    }
  }
});

window.addEventListener("keyup", (event) => {
  const keyCode = event.keyCode;
  if (keyCode === 16) {
    if (isSprinting) {
      isSprinting = false;
      camera.speed = defaultSpeed;
    }
  }
});

const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

const sphere = MeshBuilder.CreateSphere(
  "sphere1",
  { diameter: 2, segments: 16 },
  scene
);
sphere.position = new Vector3(0, 1, 0);

const ground = MeshBuilder.CreateGround(
  "ground1",
  { width: 50, height: 50, subdivisions: 2 },
  scene
);
ground.checkCollisions = true;

const groundMaterial = new StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
ground.material = groundMaterial;

const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
const skyMaterial = new SkyMaterial("skyMaterial", scene);
skyMaterial.backFaceCulling = false;
skyMaterial.turbidity = 10;
skyMaterial.luminance = 1;
skyMaterial.inclination = 0.2;
skyMaterial.azimuth = 0.25;

skybox.material = skyMaterial;
skybox.infiniteDistance = true;

const waterMesh = MeshBuilder.CreateGround(
  "waterMesh",
  { width: 100, height: 100, subdivisions: 32 },
  scene
);
waterMesh.position.y = -0.5;

const waterMaterial = new WaterMaterial(
  "waterMaterial",
  scene,
  new Vector2(1024, 1024)
);
waterMaterial.backFaceCulling = true;
waterMaterial.windForce = -5;
waterMaterial.waveHeight = 0.1;
waterMaterial.waterColor = new Color3(0.1, 0.1, 0.6);
waterMaterial.colorBlendFactor = 0.2;

waterMaterial.addToRenderList(skybox);
waterMaterial.addToRenderList(sphere);

waterMesh.material = waterMaterial;

const wallHeight = 100;
const wallThickness = 0.1;
const groundSize = 50;

const wall1 = MeshBuilder.CreateBox(
  "wall1",
  { width: groundSize, height: wallHeight, depth: wallThickness },
  scene
);
wall1.position = new Vector3(0, wallHeight / 2, groundSize / 2);
wall1.checkCollisions = true;
wall1.isVisible = false;

const wall2 = MeshBuilder.CreateBox(
  "wall2",
  { width: groundSize, height: wallHeight, depth: wallThickness },
  scene
);
wall2.position = new Vector3(0, wallHeight / 2, -groundSize / 2);
wall2.checkCollisions = true;
wall2.isVisible = false;

const wall3 = MeshBuilder.CreateBox(
  "wall3",
  { width: wallThickness, height: wallHeight, depth: groundSize },
  scene
);
wall3.position = new Vector3(-groundSize / 2, wallHeight / 2, 0);
wall3.checkCollisions = true;
wall3.isVisible = false;

const wall4 = MeshBuilder.CreateBox(
  "wall4",
  { width: wallThickness, height: wallHeight, depth: groundSize },
  scene
);
wall4.position = new Vector3(groundSize / 2, wallHeight / 2, 0);
wall4.checkCollisions = true;
wall4.isVisible = false;

engine.runRenderLoop(() => {
  scene.render();
  if (fpsDisplay) {
    fpsDisplay.textContent = "FPS: " + engine.getFps().toFixed();
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});
