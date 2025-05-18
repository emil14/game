import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Vector2 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SkyMaterial } from "@babylonjs/materials/sky";
import { WaterMaterial } from "@babylonjs/materials/water";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";
import { Animation } from "@babylonjs/core/Animations/animation";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";

// +++ Import Chest and registration logic +++
import { Chest, registerChest } from "./interactables"; // playerHasKey is used by Chest internally, playerAcquiresKey for testing

// +++ Import Spider class +++
import { Spider } from "./enemies/spider";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const fpsDisplay = document.getElementById("fpsDisplay") as HTMLElement;
const staminaText = document.getElementById("staminaText") as HTMLElement;
const staminaBarFill = document.getElementById("staminaBarFill") as HTMLElement;
const healthText = document.getElementById("healthText") as HTMLElement;
const healthBarFill = document.getElementById("healthBarFill") as HTMLElement;
const bloodScreenEffect = document.getElementById(
  "bloodScreenEffect"
) as HTMLElement;
const enemyInfoContainer = document.getElementById(
  "enemyInfoContainer"
) as HTMLElement;
const enemyHealthText = document.getElementById(
  "enemyHealthText"
) as HTMLElement;
const enemyHealthBarFill = document.getElementById(
  "enemyHealthBarFill"
) as HTMLElement;
const enemyNameText = document.getElementById("enemyNameText") as HTMLElement;
const enemyLevelText = document.getElementById("enemyLevelText") as HTMLElement;
const crosshairElement = document.getElementById("crosshair") as HTMLElement;
const fightMusic = document.getElementById("fightMusic") as HTMLAudioElement;

if (crosshairElement) {
  crosshairElement.textContent = "•"; // Set default crosshair to bullet
}

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});

const scene = new Scene(engine);

// +++ Add array to hold spider instances +++
let spiders: Spider[] = [];

let playerSword: AbstractMesh | null = null;
let isSwinging = false; // Moved here to be accessible by onPointerDown

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
console.log("Camera minZ:", camera.minZ, "Camera maxZ:", camera.maxZ);
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

// Define a max distance for the raycast
const crosshairMaxDistance = 30; // Adjust as needed, maximum distance to detect enemy

camera.ellipsoid = new Vector3(0.5, 0.8, 0.5);
camera.checkCollisions = true;
camera.applyGravity = true;
camera.speed = 2.0;
const defaultSpeed = camera.speed;
const runSpeedMultiplier = 2.0;
camera.angularSensibility = 2000;
camera.inertia = 0;

// Crouching variables
let isCrouching = false;
const crouchSpeedMultiplier = 0.5;
const crouchCameraPositionY = 1.0; // Adjusted camera height when crouching
const standCameraPositionY = 1.6; // Normal camera height

// Stamina variables
let maxStamina = 100;
let currentStamina = maxStamina;
const staminaDepletionRate = 10; // units per second
const staminaRegenerationRate = 5; // units per second
let isShiftPressed = false; // To track if shift is held down

// Health variables
let maxHealth = 100;
let currentHealth = maxHealth;
let playerIsDead = false; // To track player death state

// Player attack damage
const playerAttackDamage = 15; // Player deals 15 damage per hit

// Track movement keys state
let isMovingForward = false;
let isMovingBackward = false;
let isMovingLeft = false;
let isMovingRight = false;

// Fight mode state
let isInFightMode = false;

camera.keysUp.push(87);
camera.keysDown.push(83);
camera.keysLeft.push(65);
camera.keysRight.push(68);

let isSprinting = false;
window.addEventListener("keydown", (event) => {
  const keyCode = event.keyCode;

  if (keyCode === 16) {
    // Shift key
    isShiftPressed = true;
    if (currentStamina > 0 && !isSprinting) {
      isSprinting = true;
      if (isCrouching) {
        camera.speed = defaultSpeed; // Sprinting while crouching is normal speed
      } else {
        camera.speed = defaultSpeed * runSpeedMultiplier;
      }
    }
  } else if (keyCode === 87) {
    // W
    isMovingForward = true;
  } else if (keyCode === 83) {
    // S
    isMovingBackward = true;
  } else if (keyCode === 65) {
    // A
    isMovingLeft = true;
  } else if (keyCode === 68) {
    // D
    isMovingRight = true;
  } else if (keyCode === 67) {
    // C key for crouch
    isCrouching = !isCrouching;
    if (isCrouching) {
      camera.position.y = crouchCameraPositionY;
      camera.ellipsoid = new Vector3(0.5, 0.5, 0.5); // Smaller ellipsoid when crouching
      if (isSprinting) {
        camera.speed = defaultSpeed; // Sprinting while crouching
      } else {
        camera.speed = defaultSpeed * crouchSpeedMultiplier;
      }
    } else {
      camera.position.y = standCameraPositionY;
      camera.ellipsoid = new Vector3(0.5, 0.8, 0.5); // Restore normal ellipsoid
      if (isSprinting) {
        camera.speed = defaultSpeed * runSpeedMultiplier;
      } else {
        camera.speed = defaultSpeed;
      }
    }
  }
});

window.addEventListener("keyup", (event) => {
  const keyCode = event.keyCode;
  if (keyCode === 16) {
    // Shift key
    isShiftPressed = false;
    if (isSprinting) {
      isSprinting = false;
      if (isCrouching) {
        camera.speed = defaultSpeed * crouchSpeedMultiplier; // Return to crouch speed
      } else {
        camera.speed = defaultSpeed; // Return to normal speed
      }
    }
  } else if (keyCode === 87) {
    // W
    isMovingForward = false;
  } else if (keyCode === 83) {
    // S
    isMovingBackward = false;
  } else if (keyCode === 65) {
    // A
    isMovingLeft = false;
  } else if (keyCode === 68) {
    // D
    isMovingRight = false;
  }
});

const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

// Add a DirectionalLight for the sun
const sunLight = new DirectionalLight("sunLight", new Vector3(0, -1, 0), scene);
sunLight.intensity = 1.0; // Sun intensity
sunLight.diffuse = new Color3(1, 0.9, 0.7); // Warm sun color
sunLight.specular = new Color3(1, 1, 0.8);

// Add a PointLight parented to the camera
const playerLight = new PointLight(
  "playerLight",
  new Vector3(0, 0.5, 0),
  scene
);
playerLight.intensity = 0.3; // Adjust intensity as needed
playerLight.range = 10; // Adjust range as needed
playerLight.diffuse = new Color3(1, 0.9, 0.7); // Warm light color
playerLight.parent = camera;

// Day/Night Cycle parameters
const CYCLE_DURATION_SECONDS = 1440; // 24 minutes
let currentCycleTime = CYCLE_DURATION_SECONDS / 2; // In seconds, progresses from 0 to CYCLE_DURATION_SECONDS

const ground = MeshBuilder.CreateGround(
  "ground1",
  { width: 50, height: 50, subdivisions: 2 },
  scene
);
ground.checkCollisions = true;

const groundMaterial = new StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
ground.material = groundMaterial;

const skybox = MeshBuilder.CreateBox(
  "skyBox",
  {
    size: 1000,
  },
  scene
);
skybox.infiniteDistance = true;

// --- Procedural skybox (commented out for night skybox) ---
// const skyboxMaterial = new SkyMaterial("skyBox", scene);
// skyboxMaterial.backFaceCulling = false;
// skyboxMaterial.turbidity = 10;
// skyboxMaterial.luminance = 1.0;
// skyboxMaterial.mieDirectionalG = 0.8;
// skyboxMaterial.useSunPosition = true;
// skybox.material = skyboxMaterial;
// skybox.infiniteDistance = true;

// --- Night skybox using CubeTexture ---
const nightSkyboxMaterial = new StandardMaterial("nightSkyboxMaterial", scene);
nightSkyboxMaterial.backFaceCulling = false;
nightSkyboxMaterial.reflectionTexture = new CubeTexture(
  "assets/skybox/night/bkg1",
  scene,
  [
    "_right.png", // +X
    "_top.png", // +Y
    "_front.png", // +Z
    "_left.png", // -X
    "_bot.png", // -Y
    "_back.png", // -Z
  ]
);
nightSkyboxMaterial.reflectionTexture.coordinatesMode = 5; // SKYBOX_MODE
nightSkyboxMaterial.disableLighting = true;
skybox.material = nightSkyboxMaterial;

// const waterMesh = MeshBuilder.CreateGround(
//   "waterMesh",
//   { width: 100, height: 100, subdivisions: 32 },
//   scene
// );
// waterMesh.position.y = -0.5;

// const waterMaterial = new WaterMaterial(
//   "waterMaterial",
//   scene,
//   new Vector2(1024, 1024)
// );
// waterMaterial.backFaceCulling = true;
// waterMaterial.windForce = -5;
// waterMaterial.waveHeight = 0.1;
// waterMaterial.waterColor = new Color3(0.1, 0.1, 0.6);
// waterMaterial.colorBlendFactor = 0.2;

// waterMaterial.addToRenderList(skybox);

// waterMesh.material = waterMaterial;

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

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "palm_tree1.glb",
  scene
).then((result) => {
  const palmTreeVisual = result.meshes[0] as AbstractMesh;
  palmTreeVisual.name = "palmTreeVisual1";

  // Set initial desired world position and scaling for the visual model first
  const initialPalmTreeWorldPos = new Vector3(10, 0, 10);
  palmTreeVisual.position = initialPalmTreeWorldPos.clone();
  palmTreeVisual.scaling = new Vector3(2, 2, 2); // User updated scaling

  // Disable collisions on the visual mesh and its children early
  palmTreeVisual.checkCollisions = false;
  palmTreeVisual
    .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
    .forEach((childMesh) => {
      childMesh.checkCollisions = false;
    });

  // Ensure transformations are applied before getting bounding box
  palmTreeVisual.computeWorldMatrix(true);

  // Get the bounding vectors for the entire hierarchy in world space
  const boundingInfo = palmTreeVisual.getHierarchyBoundingVectors(true);
  const palmTreeDimensions = boundingInfo.max.subtract(boundingInfo.min);

  // Create an invisible collider box based on the visual model's dimensions
  const palmTreeCollider = MeshBuilder.CreateBox(
    "palmTreeCollider1",
    {
      width: palmTreeDimensions.x > 0 ? palmTreeDimensions.x : 0.1,
      height: palmTreeDimensions.y > 0 ? palmTreeDimensions.y : 0.1,
      depth: palmTreeDimensions.z > 0 ? palmTreeDimensions.z : 0.1,
    },
    scene
  );

  // Position the collider box to encapsulate the visual model in world space
  // The center of the bounding box is (min + max) / 2
  palmTreeCollider.position = boundingInfo.min.add(
    palmTreeDimensions.scale(0.5)
  );

  palmTreeCollider.checkCollisions = true;
  palmTreeCollider.isVisible = false; // Set to true to debug collider position/size

  // Parent the visual model to the collider box
  // The visual model's world position was already set. Now, by parenting,
  // its local position will be automatically calculated relative to the collider.
  // To ensure it stays in the same world spot after parenting, we can subtract the new parent's world position.
  palmTreeVisual.parent = palmTreeCollider;
  palmTreeVisual.position = initialPalmTreeWorldPos.subtract(
    palmTreeCollider.position
  );
});

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "palm_tree2.glb",
  scene
).then((result) => {
  const palmTreeVisual = result.meshes[0] as AbstractMesh;
  palmTreeVisual.name = "palmTreeVisual2";
  const initialPalmTreeWorldPos = new Vector3(5, 0, 15);
  palmTreeVisual.position = initialPalmTreeWorldPos.clone();
  palmTreeVisual.scaling = new Vector3(1.8, 1.8, 1.8);
  palmTreeVisual.checkCollisions = false;
  palmTreeVisual
    .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
    .forEach((childMesh) => {
      childMesh.checkCollisions = false;
    });
  palmTreeVisual.computeWorldMatrix(true);
  const boundingInfo = palmTreeVisual.getHierarchyBoundingVectors(true);
  const palmTreeDimensions = boundingInfo.max.subtract(boundingInfo.min);
  const palmTreeCollider = MeshBuilder.CreateBox(
    "palmTreeCollider2",
    {
      width: palmTreeDimensions.x > 0 ? palmTreeDimensions.x : 0.1,
      height: palmTreeDimensions.y > 0 ? palmTreeDimensions.y : 0.1,
      depth: palmTreeDimensions.z > 0 ? palmTreeDimensions.z : 0.1,
    },
    scene
  );
  palmTreeCollider.position = boundingInfo.min.add(
    palmTreeDimensions.scale(0.5)
  );
  palmTreeCollider.checkCollisions = true;
  palmTreeCollider.isVisible = false;
  palmTreeVisual.parent = palmTreeCollider;
  palmTreeVisual.position = initialPalmTreeWorldPos.subtract(
    palmTreeCollider.position
  );
});

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "palm_tree3.glb",
  scene
).then((result) => {
  const palmTreeVisual = result.meshes[0] as AbstractMesh;
  palmTreeVisual.name = "palmTreeVisual3";
  const initialPalmTreeWorldPos = new Vector3(-5, 0, 15);
  palmTreeVisual.position = initialPalmTreeWorldPos.clone();
  palmTreeVisual.scaling = new Vector3(2.2, 2.2, 2.2);
  palmTreeVisual.checkCollisions = false;
  palmTreeVisual
    .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
    .forEach((childMesh) => {
      childMesh.checkCollisions = false;
    });
  palmTreeVisual.computeWorldMatrix(true);
  const boundingInfo = palmTreeVisual.getHierarchyBoundingVectors(true);
  const palmTreeDimensions = boundingInfo.max.subtract(boundingInfo.min);
  const palmTreeCollider = MeshBuilder.CreateBox(
    "palmTreeCollider3",
    {
      width: palmTreeDimensions.x > 0 ? palmTreeDimensions.x : 0.1,
      height: palmTreeDimensions.y > 0 ? palmTreeDimensions.y : 0.1,
      depth: palmTreeDimensions.z > 0 ? palmTreeDimensions.z : 0.1,
    },
    scene
  );
  palmTreeCollider.position = boundingInfo.min.add(
    palmTreeDimensions.scale(0.5)
  );
  palmTreeCollider.checkCollisions = true;
  palmTreeCollider.isVisible = false;
  palmTreeVisual.parent = palmTreeCollider;
  palmTreeVisual.position = initialPalmTreeWorldPos.subtract(
    palmTreeCollider.position
  );
});

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "chest_closed.glb",
  scene
).then((result) => {
  const chestVisual = result.meshes[0] as AbstractMesh;
  chestVisual.name = "chestClosedVisual";
  const initialChestWorldPos = new Vector3(18, 0, 18); // Near the spider at (20,0,20)
  chestVisual.position = initialChestWorldPos.clone();
  chestVisual.scaling = new Vector3(1, 1, 1);
  chestVisual.checkCollisions = false;
  chestVisual
    .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
    .forEach((childMesh) => {
      childMesh.checkCollisions = false;
    });
  chestVisual.computeWorldMatrix(true);
  const boundingInfo = chestVisual.getHierarchyBoundingVectors(true);
  const chestDimensions = boundingInfo.max.subtract(boundingInfo.min);
  const chestCollider = MeshBuilder.CreateBox(
    "chestClosedCollider",
    {
      width: chestDimensions.x > 0 ? chestDimensions.x : 0.1,
      height: chestDimensions.y > 0 ? chestDimensions.y : 0.1,
      depth: chestDimensions.z > 0 ? chestDimensions.z : 0.1,
    },
    scene
  );
  chestCollider.position = boundingInfo.min.add(chestDimensions.scale(0.5));
  chestCollider.checkCollisions = true;
  chestCollider.isVisible = false;
  chestVisual.parent = chestCollider;
  chestVisual.position = initialChestWorldPos.subtract(chestCollider.position);

  // +++ Create and register the Chest instance +++
  const gameChest = new Chest(chestCollider, true, "key_old_chest", () => {
    console.log("The old chest was opened!");
    // Potentially change model to an open chest, give loot, etc.
    // For now, we can even remove the interactable nature or change its icon
    if (chestCollider.metadata && chestCollider.metadata.chestInstance) {
      // Update icon on crosshair if player is still looking at it
      const ray = camera.getForwardRay(crosshairMaxDistance);
      const pickInfo = scene.pickWithRay(ray, (mesh) => mesh === chestCollider);
      if (pickInfo && pickInfo.hit && crosshairElement) {
        crosshairElement.textContent =
          chestCollider.metadata.chestInstance.getDisplayIcon();
      }
    }
  });
  registerChest(gameChest);

  // Simulate player finding the key after 5 seconds for testing
  // setTimeout(() => {
  //   playerAcquiresKey("key_old_chest");
  //   // If player is looking at the chest, icon should update on next raycast
  // }, 5000);

  // Make the chest part of the water material's reflection/refraction
  // if (waterMaterial && waterMesh) {
  // waterMaterial.addToRenderList(chestVisual); // Add visual mesh if it should reflect/refract
  // waterMaterial.addToRenderList(chestCollider); // Or collider if that's more appropriate and visible
  // }
});

// Sword Loading and Setup
SceneLoader.ImportMeshAsync("", "assets/models/pirate_kit/", "sword.glb", scene)
  .then((result) => {
    const swordMesh = result.meshes[0];
    if (swordMesh) {
      playerSword = swordMesh;
      playerSword.name = "playerSword";

      // Parent to camera
      playerSword.parent = camera;

      // Approximate position and rotation (adjust these values as needed)
      playerSword.position = new Vector3(0.35, -0.35, 1.2); // Moved slightly further away
      playerSword.rotationQuaternion = null; // Use Euler angles for simpler initial setup
      // Rotate to point the blade forward (adjust Y rotation)
      playerSword.rotation = new Vector3(0, Math.PI / 12 + Math.PI / 2, 0);

      // Scale if necessary (e.g., if the model is too large or small)
      playerSword.scaling = new Vector3(0.7, 0.7, 0.7); // Reduced scale

      // Ensure sword doesn't cast shadows or interact with collisions for now
      playerSword.receiveShadows = false;
      playerSword.renderingGroupId = 1; // Render on top of other objects
      playerSword.getChildMeshes().forEach((mesh) => {
        mesh.receiveShadows = false;
        mesh.checkCollisions = false;
        mesh.renderingGroupId = 1; // Apply to children as well
      });
      swordMesh.checkCollisions = false;
      swordMesh.renderingGroupId = 1; // Also apply to the root mesh of the sword import

      console.log("Player sword loaded:", playerSword);
      console.log("Sword position (local to camera):", playerSword.position);
      console.log("Sword rotation (local to camera):", playerSword.rotation);
      console.log("Sword visibility:", playerSword.isVisible);
    } else {
      console.error("Sword mesh could not be loaded from the GLB file.");
    }
  })
  .catch((error) => {
    console.error("Error loading sword:", error);
  });

// Sword Swing Animation (defined but keys set dynamically)
const swingAnimation = new Animation(
  "swordSwing",
  "rotation.z", // Changed from rotation.x to rotation.z
  30, // FPS
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CONSTANT
);

scene.onPointerDown = (evt) => {
  // evt.button === 0 for left mouse button
  if (evt.button === 0 && playerSword && !isSwinging) {
    isSwinging = true;

    // Define animation keys dynamically when swing starts
    const initialRotationZ = playerSword.rotation.z; // Current resting Z rotation
    const swingAngle = Math.PI / 3; // Swing out by 60 degrees around Z-axis

    const swingKeysDynamic = [];
    swingKeysDynamic.push({ frame: 0, value: initialRotationZ });
    swingKeysDynamic.push({ frame: 5, value: initialRotationZ + swingAngle }); // Swing out
    swingKeysDynamic.push({ frame: 15, value: initialRotationZ }); // Return to initial Z rotation

    swingAnimation.setKeys(swingKeysDynamic);

    // --- Attack Hit Detection ---
    // Check for hit shortly after swing starts
    // Animation is 15 frames at 30 FPS (0.5 seconds total)
    // Let's check for hit around 150ms into the swing
    const hitCheckDelay = 150; // milliseconds

    setTimeout(() => {
      if (!playerSword || playerIsDead) return; // Check if sword exists and player is alive

      const ray = camera.getForwardRay(crosshairMaxDistance);
      const pickInfo = scene.pickWithRay(
        ray,
        (mesh) => mesh.metadata && mesh.metadata.enemyType === "spider"
      );

      if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
        const spiderInstance = pickInfo.pickedMesh.metadata.instance as Spider;
        if (spiderInstance && spiderInstance.currentHealth > 0) {
          console.log(
            `Player hit ${spiderInstance.name} for ${playerAttackDamage} damage.`
          );
          spiderInstance.takeDamage(playerAttackDamage);
          // Future: Play a hit sound effect
          // Future: If spider has a 'getHit' animation, play it here
        }
      }
    }, hitCheckDelay);
    // --- End Attack Hit Detection ---

    scene.beginDirectAnimation(
      playerSword, // Target
      [swingAnimation], // Animations
      0, // Start frame
      15, // End frame
      false, // Loop animation
      1, // Speed ratio
      () => {
        // On animation end
        isSwinging = false;
      }
    );
  }
};

// Function to initialize game elements, including spiders
async function initializeGameAssets() {
  // Create a spider instance
  try {
    const spiderInstance = await Spider.Create(
      scene,
      new Vector3(20, 0, 20),
      defaultSpeed
    );
    spiders.push(spiderInstance);

    // Setup player damage callback for this spider
    spiderInstance.setOnPlayerDamaged((damage: number) => {
      if (playerIsDead) return;

      currentHealth -= damage;
      if (bloodScreenEffect) {
        bloodScreenEffect.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
        bloodScreenEffect.style.opacity = "1";
        setTimeout(() => {
          bloodScreenEffect.style.opacity = "0";
        }, 200); // Duration of the flash
      }

      if (currentHealth < 0) {
        currentHealth = 0;
      }

      if (currentHealth === 0 && !playerIsDead) {
        playerIsDead = true;
        alert("You are dead! The page will now reload.");
        window.location.reload();
      }
    });

    console.log("Spider created and added to scene.");
  } catch (error) {
    console.error("Failed to create spider:", error);
  }

  // Potentially load other assets or initialize other game entities here
}

// Call initializeGameAssets after scene setup and before render loop for initial spider
// Ensure this is called in a context where `await` is allowed, e.g., an async IIFE or a .then() block
// For simplicity, let's assume it's called appropriately. One way:
(async () => {
  // Any other async setup that needs to happen before spiders are created
  // For example, if `defaultSpeed` or `scene` relied on other async operations not shown.
  await initializeGameAssets();
})();

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000; // Delta time in seconds
  currentCycleTime = (currentCycleTime + deltaTime) % CYCLE_DURATION_SECONDS;
  const cycleProgress = currentCycleTime / CYCLE_DURATION_SECONDS; // 0 (midnight) to 1 (next midnight)

  // Animate Sky: inclination goes from 0 (sunrise) to 0.5 (midday) and back to 0 (sunset)
  // then night. We'll map progress to inclination:
  // 0.0 (midnight) -> inclination just below horizon
  // 0.25 (sunrise) -> inclination 0
  // 0.5 (midday) -> inclination 0.5 (zenith)
  // 0.75 (sunset) -> inclination 0
  // 1.0 (midnight) -> inclination just below horizon

  let currentInclination;
  const dayNightTransition = 0.05; // Small portion of the cycle for sunrise/sunset blending

  if (cycleProgress >= 0 && cycleProgress < 0.25 - dayNightTransition) {
    // Deep night
    currentInclination = -0.2; // Sun further below horizon
    // skyboxMaterial.luminance = 0.005; // Very dark
    // skyboxMaterial.turbidity = 20; // Higher turbidity can make night sky darker, less star definition
    // skyboxMaterial.rayleigh = 0.5; // Lower rayleigh for less blue scattering, allowing dark blue
    light.intensity = 0.05; // Very dim ambient
    sunLight.intensity = 0; // Sun off
  } else if (cycleProgress < 0.25 + dayNightTransition) {
    // Sunrise transition
    const sunriseProgress =
      (cycleProgress - (0.25 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = -0.2 + sunriseProgress * 0.2; // from -0.2 to 0
    // skyboxMaterial.luminance = Color3.Lerp(
    //   new Color3(0.005, 0, 0),
    //   new Color3(1.0, 0, 0),
    //   sunriseProgress
    // ).r; // LERP luminance
    // skyboxMaterial.turbidity = 20 - sunriseProgress * 15; // Turbidity from 20 down to 5
    // skyboxMaterial.rayleigh = 0.5 + sunriseProgress * 1.5; // Rayleigh from 0.5 up to 2.0
    light.intensity = 0.05 + sunriseProgress * 0.65;
    sunLight.intensity = sunriseProgress * 1.0;
  } else if (cycleProgress < 0.5 - dayNightTransition) {
    // Daytime
    const dayProgress =
      (cycleProgress - (0.25 + dayNightTransition)) /
      (0.5 - dayNightTransition - (0.25 + dayNightTransition));
    currentInclination = dayProgress * 0.5; // 0 to 0.5
    // skyboxMaterial.luminance = 1.0;
    // skyboxMaterial.turbidity = 5;
    // skyboxMaterial.rayleigh = 2.0;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
  } else if (cycleProgress < 0.5 + dayNightTransition) {
    // Midday peak (smooth transition for inclination)
    const middayProgress =
      (cycleProgress - (0.5 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = 0.5 - middayProgress * 0.0; // Stays around 0.5
    // skyboxMaterial.luminance = 1.0;
    // skyboxMaterial.turbidity = 5;
    // skyboxMaterial.rayleigh = 2.0;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
  } else if (cycleProgress < 0.75) {
    // MODIFIED: Afternoon, leading to sunset at 0.75 (18:00)
    const afternoonStart = 0.5 + dayNightTransition; // Starts after midday peak
    const afternoonEnd = 0.75;
    const afternoonDuration = afternoonEnd - afternoonStart;
    const afternoonProgress =
      (cycleProgress - afternoonStart) / afternoonDuration;

    currentInclination = 0.5 - afternoonProgress * 0.5; // From 0.5 down to 0
    // skyboxMaterial.luminance = 1.0; // Still full day brightness
    // skyboxMaterial.turbidity = 5;
    // skyboxMaterial.rayleigh = 2.0;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
  } else if (cycleProgress < 0.75 + dayNightTransition) {
    // MODIFIED: Dusk, sun goes from horizon to below
    const duskStart = 0.75;
    const duskEnd = 0.75 + dayNightTransition;
    const duskDuration = duskEnd - duskStart; // This is equal to dayNightTransition
    const duskProgress = (cycleProgress - duskStart) / duskDuration; // Progress from 0 to 1

    currentInclination = 0.0 - duskProgress * 0.2; // From 0 down to -0.2
    // Light and sky properties transition from day to night
    // skyboxMaterial.luminance = Color3.Lerp(
    //   new Color3(1.0, 0, 0), // Start with full luminance (adjusted for sunset color if desired)
    //   new Color3(0.005, 0, 0),
    //   duskProgress
    // ).r;
    // skyboxMaterial.turbidity = 5 + duskProgress * 15; // Turbidity from 5 up to 20
    // skyboxMaterial.rayleigh = 2.0 - duskProgress * 1.5; // Rayleigh from 2.0 down to 0.5
    light.intensity = 0.7 - duskProgress * 0.65; // Ambient light from 0.7 down to 0.05
    sunLight.intensity = 1.0 - duskProgress * 1.0; // Sun light from 1.0 down to 0.0
  } else {
    // Night
    currentInclination = -0.2; // Sun further below horizon
    // skyboxMaterial.luminance = 0.005; // Very dark
    // skyboxMaterial.turbidity = 20;
    // skyboxMaterial.rayleigh = 0.5;
    light.intensity = 0.05; // Very dim ambient
    sunLight.intensity = 0; // Sun off
  }

  // skyboxMaterial.inclination = currentInclination;
  // skyboxMaterial.azimuth = 0.25; // Fixed azimuth for now, could also be animated

  // Update sun position for SkyMaterial (Babylon uses a convention where Y is up)
  // A common way to get sun position from inclination (angle from horizon) and azimuth (rotation around Y)
  // inclination = 0 is horizon, 0.5 * PI is zenith. SkyMaterial inclination is 0 to 0.5.
  // const phi = skyboxMaterial.inclination * Math.PI; // Convert to radians for spherical coords, 0 to PI/2
  // const theta = skyboxMaterial.azimuth * 2 * Math.PI; // Convert to radians, 0 to 2PI

  // skyboxMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
  // skyboxMaterial.sunPosition.y = Math.sin(phi);
  // skyboxMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);

  // Update DirectionalLight direction
  // DirectionalLight direction is where the light is pointing TO.
  // If sunPosition is (0,1,0) (zenith), light direction should be (0,-1,0) (straight down).
  // sunLight.direction = skyboxMaterial.sunPosition.scale(-1);

  let isAnyEnemyAggro = false; // Reset per frame

  // +++ Update spiders and check for aggro +++
  if (!playerIsDead) {
    spiders.forEach((spider) => {
      if (spider.currentHealth > 0) {
        // Only update active spiders
        spider.update(deltaTime, camera);
        if (spider.getIsAggro()) {
          isAnyEnemyAggro = true;
        }
      }
    });
  }

  // Update fight music based on aggro state
  if (isAnyEnemyAggro && !isInFightMode) {
    isInFightMode = true;
    if (fightMusic) {
      fightMusic
        .play()
        .catch((error) => console.warn("Fight music play failed:", error));
    }
  } else if (!isAnyEnemyAggro && isInFightMode) {
    isInFightMode = false;
    if (fightMusic) {
      fightMusic.pause();
      fightMusic.currentTime = 0; // Reset music to the beginning
    }
  }

  // Raycasting for enemy info
  if (
    enemyInfoContainer &&
    enemyHealthText &&
    enemyHealthBarFill &&
    enemyNameText &&
    enemyLevelText &&
    crosshairElement
  ) {
    const ray = camera.getForwardRay(crosshairMaxDistance);
    // Allow picking spider OR any mesh that has 'interactableType' in its metadata
    const pickInfo = scene.pickWithRay(
      ray,
      (mesh) =>
        (mesh.metadata && mesh.metadata.enemyType === "spider") ||
        (mesh.metadata && mesh.metadata.interactableType)
    );

    let lookingAtEnemy = false;
    let lookingAtInteractable = false;

    if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
      const pickedMesh = pickInfo.pickedMesh;

      // Check if it's the spider
      if (pickedMesh.metadata && pickedMesh.metadata.enemyType === "spider") {
        lookingAtEnemy = true;
        enemyInfoContainer.style.display = "block";
        crosshairElement.classList.add("crosshair-enemy-focus");
        if (crosshairElement) crosshairElement.textContent = "💢"; // Fight mode crosshair

        // +++ Get spider instance from metadata to display its info +++
        const spiderInstance = pickedMesh.metadata.instance as Spider;
        if (spiderInstance) {
          enemyNameText.textContent = spiderInstance.name;
          enemyLevelText.textContent = `| Lvl ${spiderInstance.level}`;
          enemyHealthText.textContent = `${spiderInstance.currentHealth.toFixed(
            0
          )}/${spiderInstance.maxHealth}`;
          enemyHealthBarFill.style.width = `${
            (spiderInstance.currentHealth / spiderInstance.maxHealth) * 100
          }%`;
        } else {
          // Fallback or hide if instance not found (should not happen)
          enemyNameText.textContent = "Spider";
          enemyLevelText.textContent = "| Lvl ?";
          enemyHealthText.textContent = "-/- ";
          enemyHealthBarFill.style.width = "100%";
        }
      }
      // +++ Check if it's an interactable Chest +++
      else if (
        pickedMesh.metadata &&
        pickedMesh.metadata.interactableType === "chest"
      ) {
        lookingAtInteractable = true;
        const chestInstance = pickedMesh.metadata.chestInstance as Chest;
        if (crosshairElement) {
          crosshairElement.textContent = chestInstance.getDisplayIcon();
          crosshairElement.classList.remove("crosshair-enemy-focus"); // Ensure enemy focus style is removed
          // Optional: add a specific class for interactable focus
          // crosshairElement.classList.add("crosshair-interactable-focus");
        }
        // Hide enemy info if we are looking at a chest
        enemyInfoContainer.style.display = "none";
      }
    }

    if (!lookingAtEnemy && !lookingAtInteractable) {
      enemyInfoContainer.style.display = "none";
      crosshairElement.classList.remove("crosshair-enemy-focus");
      // crosshairElement.classList.remove("crosshair-interactable-focus");
      if (crosshairElement) crosshairElement.textContent = "•"; // Normal crosshair
    }
  }

  scene.render();
  if (fpsDisplay) {
    fpsDisplay.textContent = "FPS: " + engine.getFps().toFixed();
  }
  if (staminaText && staminaBarFill) {
    staminaText.textContent = currentStamina.toFixed(0) + "/" + maxStamina;
    staminaBarFill.style.width = (currentStamina / maxStamina) * 100 + "%";
  }
  if (healthText && healthBarFill) {
    healthText.textContent = currentHealth.toFixed(0) + "/" + maxHealth;
    healthBarFill.style.width = (currentHealth / maxHealth) * 100 + "%";
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});

// Tab Menu Functionality
document.addEventListener("DOMContentLoaded", () => {
  const tabMenu = document.getElementById("tab-menu") as HTMLElement | null;
  const mainUiContainer = document.querySelector(
    ".ui-container"
  ) as HTMLElement | null;
  const fpsDisplayElement = document.getElementById(
    "fpsDisplay"
  ) as HTMLElement | null;
  const enemyInfoContainerElement = document.getElementById(
    "enemyInfoContainer"
  ) as HTMLElement | null;
  const crosshair = document.getElementById("crosshair") as HTMLElement | null;

  const tabNavigation = document.getElementById(
    "tab-navigation"
  ) as HTMLElement | null;
  const tabButtons = tabNavigation
    ? (Array.from(
        tabNavigation.querySelectorAll(".tab-button")
      ) as HTMLButtonElement[])
    : [];
  const tabPanes = document.querySelectorAll(
    "#tab-menu-content .tab-pane"
  ) as NodeListOf<HTMLElement>;

  // Stats display elements in Tab Menu (Player Stats Tab)
  const playerLevelDisplay = document.getElementById(
    "player-level"
  ) as HTMLElement | null;
  const playerHealthDisplay = document.getElementById(
    "player-health"
  ) as HTMLElement | null;
  const playerStaminaDisplay = document.getElementById(
    "player-stamina"
  ) as HTMLElement | null;
  const playerExperienceDisplay = document.getElementById(
    "player-experience"
  ) as HTMLElement | null;
  const experienceBarFillTab = document.getElementById(
    "experience-bar-fill-tab"
  ) as HTMLElement | null;
  const ingameTimeDisplayTab = document.getElementById(
    "ingame-time-tab"
  ) as HTMLElement | null;

  let isTabMenuOpen = false;
  let currentActiveTab = "player-stats-tab"; // Default tab

  const tabPlayerData = {
    level: 1,
    experienceToNextLevel: 1000,
  };

  // Canvas click listener for pointer lock
  if (canvas) {
    canvas.addEventListener("click", () => {
      if (!isTabMenuOpen && !engine.isPointerLock) {
        engine.enterPointerlock();
      }
    });
  }

  function updateStatsTabData() {
    if (
      !tabMenu ||
      tabMenu.classList.contains("hidden") ||
      currentActiveTab !== "player-stats-tab"
    )
      return;

    const currentHealthGame =
      typeof currentHealth !== "undefined" ? currentHealth : 100;
    const maxHealthGame = typeof maxHealth !== "undefined" ? maxHealth : 100;
    const currentStaminaGame =
      typeof currentStamina !== "undefined" ? currentStamina : 100;
    const maxStaminaGame = typeof maxStamina !== "undefined" ? maxStamina : 100;
    const placeholderCurrentExp = 250; // Replace with actual game variable for current experience

    if (playerLevelDisplay)
      playerLevelDisplay.textContent = tabPlayerData.level.toString();
    if (playerHealthDisplay)
      playerHealthDisplay.textContent = `${currentHealthGame.toFixed(
        0
      )} / ${maxHealthGame.toFixed(0)}`;
    if (playerStaminaDisplay)
      playerStaminaDisplay.textContent = `${currentStaminaGame.toFixed(
        0
      )} / ${maxStaminaGame.toFixed(0)}`;
    if (playerExperienceDisplay)
      playerExperienceDisplay.textContent = `${placeholderCurrentExp} / ${tabPlayerData.experienceToNextLevel}`;

    // Calculate and display game time directly for the tab menu
    if (ingameTimeDisplayTab) {
      const cycleProgressForTab = currentCycleTime / CYCLE_DURATION_SECONDS;
      const totalGameSecondsInDay = 24 * 60 * 60;
      const currentTotalGameSeconds =
        cycleProgressForTab * totalGameSecondsInDay;
      const gameHours = Math.floor(currentTotalGameSeconds / 3600) % 24;
      const gameMinutes = Math.floor((currentTotalGameSeconds % 3600) / 60);
      const formattedHours = gameHours.toString().padStart(2, "0");
      const formattedMinutes = gameMinutes.toString().padStart(2, "0");
      ingameTimeDisplayTab.textContent = `${formattedHours}:${formattedMinutes}`;
    }

    if (experienceBarFillTab) {
      const experiencePercentage =
        (placeholderCurrentExp / tabPlayerData.experienceToNextLevel) * 100;
      experienceBarFillTab.style.width = `${experiencePercentage}%`;
    }
  }

  function setActiveTab(tabId: string) {
    currentActiveTab = tabId;
    tabButtons.forEach((button) => {
      if (button.dataset.tab === tabId) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
    tabPanes.forEach((pane) => {
      if (pane.id === tabId) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });
    if (tabId === "player-stats-tab") {
      updateStatsTabData(); // Update stats if stats tab is activated
    }
    // Add similar update functions for other tabs if their content is dynamic
  }

  function openTabMenu(tabIdToShow?: string) {
    if (!tabMenu) return;
    isTabMenuOpen = true;
    tabMenu.classList.remove("hidden");
    [
      mainUiContainer,
      fpsDisplayElement,
      enemyInfoContainerElement,
      crosshair,
    ].forEach((el) => el?.classList.add("hidden"));

    if (engine.isPointerLock) {
      engine.exitPointerlock();
    }

    const targetTab = tabIdToShow || currentActiveTab || "player-stats-tab";
    setActiveTab(targetTab);
  }

  function closeTabMenu() {
    if (!tabMenu) return;
    isTabMenuOpen = false;
    tabMenu.classList.add("hidden");
    [
      mainUiContainer,
      fpsDisplayElement,
      enemyInfoContainerElement,
      crosshair,
    ].forEach((el) => el?.classList.remove("hidden"));
  }

  function toggleTabMenu(tabIdToShow?: string) {
    if (isTabMenuOpen && (!tabIdToShow || tabIdToShow === currentActiveTab)) {
      closeTabMenu();
    } else {
      openTabMenu(tabIdToShow);
    }
  }

  // Event listener for tab navigation buttons
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.dataset.tab;
      if (tabId) {
        setActiveTab(tabId);
      }
    });
  });

  // Event listener for keyboard shortcuts
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "tab") {
      event.preventDefault();
      toggleTabMenu(); // Opens to last active or default, or closes
    }
    // Added Escape key to exit pointer lock
    if (event.key.toLowerCase() === "escape") {
      if (engine.isPointerLock) {
        engine.exitPointerlock();
      }
      // Optionally, if the tab menu is open, Escape could also close it:
      // if (isTabMenuOpen) {
      //   closeTabMenu();
      // }
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      // Avoid conflicts with browser shortcuts
      switch (event.key.toLowerCase()) {
        case "i":
          event.preventDefault();
          toggleTabMenu("inventory-tab");
          break;
        case "j":
          event.preventDefault();
          toggleTabMenu("journal-tab");
          break;
        case "m":
          event.preventDefault();
          toggleTabMenu("map-tab");
          break;
      }
    }
  });

  // Initial setup
  if (tabMenu) tabMenu.classList.add("hidden");
  setActiveTab(currentActiveTab); // Set initial active tab even if menu is hidden
});
