import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SkyMaterial } from "@babylonjs/materials/sky";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Ray } from "@babylonjs/core/Culling/ray";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";

import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics";
// import { PhysicsBody } from "@babylonjs/core/Physics";

import { ClosedChest } from "./interactables";
import { Spider } from "./enemies/spider";
import { Sword } from "./weapons/sword";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

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
const deathScreen = document.getElementById("deathScreen") as HTMLElement;

crosshairElement.textContent = "•";

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});

const scene = new Scene(engine);

let havokInstance: any;
let playerBodyAggregate: PhysicsAggregate;
let playerBodyMesh: Mesh;
let spiders: Spider[] = [];
let playerSwordInstance: Sword | null = null;

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
camera.maxZ = 10000;
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);
camera.inputs.remove(camera.inputs.attached.keyboard);

const crosshairMaxDistance = 30;

const defaultSpeed = 2.0;
const runSpeedMultiplier = 2.0;
camera.angularSensibility = 2000;
camera.inertia = 0;

let isCrouching = false;
const crouchSpeedMultiplier = 0.5;
const crouchCameraPositionY = 1.0;
const standCameraPositionY = 1.6;

// Jump parameters
const jumpForce = 5; // The upward force applied for a jump
const jumpStaminaCost = 15; // Stamina consumed per jump
const groundCheckDistance = 0.2; // How far below the player to check for ground

// Player capsule dimensions (should match setupGameAndPhysics)
const playerHeight = 1.6; // Must match playerHeight in setupGameAndPhysics
const playerRadius = 0.4; // Must match playerRadius in setupGameAndPhysics

let maxStamina = 100;
let currentStamina = maxStamina;
const staminaDepletionRate = 10;
const staminaRegenerationRate = 5;

let maxHealth = 100;
let currentHealth = maxHealth;
let playerIsDead = false;
let keyRPressed = false;

let isMovingForward = false;
let isMovingBackward = false;
let isMovingLeft = false;
let isMovingRight = false;

let isInFightMode = false;

let isSprinting = false;

window.addEventListener("keydown", (event) => {
  const keyCode = event.keyCode;

  if (keyCode === 16) {
    if (currentStamina > 0 && !isSprinting && !playerIsDead) {
      isSprinting = true;
    }
  } else if (keyCode === 87) isMovingForward = true;
  else if (keyCode === 83) isMovingBackward = true;
  else if (keyCode === 65) isMovingLeft = true;
  else if (keyCode === 68) isMovingRight = true;
  else if (keyCode === 67 && !playerIsDead) {
    isCrouching = !isCrouching;
  } else if (keyCode === 32 && !playerIsDead) {
    const isOnGround = isPlayerOnGroundCheck(
      playerBodyMesh,
      scene,
      groundCheckDistance,
      playerHeight,
      playerRadius
    );

    if (
      playerBodyAggregate &&
      playerBodyAggregate.body &&
      currentStamina >= jumpStaminaCost &&
      isOnGround
    ) {
      const currentVelocity = playerBodyAggregate.body.getLinearVelocity();
      playerBodyAggregate.body.setLinearVelocity(
        new Vector3(currentVelocity.x, jumpForce, currentVelocity.z)
      );
      currentStamina -= jumpStaminaCost;
      updateStaminaBar(currentStamina, maxStamina); // Update UI immediately
    }
  } else if (keyCode === 82) {
    keyRPressed = true;
  }
});

window.addEventListener("keyup", (event) => {
  const keyCode = event.keyCode;
  if (keyCode === 16) {
    if (isSprinting) {
      isSprinting = false;
    }
  } else if (keyCode === 87) isMovingForward = false;
  else if (keyCode === 83) isMovingBackward = false;
  else if (keyCode === 65) isMovingLeft = false;
  else if (keyCode === 68) isMovingRight = false;
  else if (keyCode === 82) {
    keyRPressed = false;
  }
});

// Helper function to check if the player is on the ground
function isPlayerOnGroundCheck(
  playerMesh: Mesh,
  sceneRef: Scene,
  checkDistance: number,
  pHeight: number,
  _pRadius: number
): boolean {
  if (!playerMesh || !playerBodyAggregate || !playerBodyAggregate.body) {
    console.log("isPlayerOnGroundCheck: Missing playerMesh or physics body");
    return false;
  }

  const rayOrigin = playerMesh.getAbsolutePosition().clone(); // Start from the center of the capsule

  // Calculate ray length to reach checkDistance below the feet
  // (pHeight / 2) is distance from center to feet
  const rayLength = pHeight / 2 + checkDistance;

  const ray = new Ray(rayOrigin, Vector3.Down(), rayLength);

  const pickInfo = sceneRef.pickWithRay(
    ray,
    (mesh) =>
      mesh !== playerMesh && // Don't pick the player itself
      mesh.isPickable && // Mesh must be pickable
      mesh.isEnabled() && // Mesh must be enabled
      !mesh.name.toLowerCase().includes("spider") && // Explicitly ignore spiders
      mesh.getTotalVertices() > 0 // Ensure it's actual geometry
  );

  if (pickInfo && pickInfo.hit) {
    // console.log("Ground check hit:", pickInfo.pickedMesh?.name);
    return true;
  }
  // console.log("Ground check miss. Origin:", rayOrigin, "Length:", rayLength);
  return false;
}

const light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
light.intensity = 0.7;

const sunLight = new DirectionalLight("sunLight", new Vector3(0, -1, 0), scene);
sunLight.intensity = 1.0;
sunLight.diffuse = new Color3(1, 0.9, 0.7);
sunLight.specular = new Color3(1, 1, 0.8);

const playerLight = new PointLight(
  "playerLight",
  new Vector3(0, 0.5, 0),
  scene
);
playerLight.intensity = 0.3;
playerLight.range = 10;
playerLight.diffuse = new Color3(1, 0.9, 0.7);
playerLight.parent = camera;

const CYCLE_DURATION_SECONDS = 1440;
let currentCycleTime = CYCLE_DURATION_SECONDS / 2;

// New Day/Night Cycle Parameters
const NEW_SUNRISE_HOUR = 5;
const NEW_SUNSET_HOUR = 20;

const newSunrisePoint = NEW_SUNRISE_HOUR / 24; // Progress point for sunrise center
const newSunsetPoint = NEW_SUNSET_HOUR / 24; // Progress point for sunset center
const newMiddayPoint = (newSunrisePoint + newSunsetPoint) / 2; // Sun is highest

const dayNightTransitionWidth = 0.05; // Half-width of the transition period (0.05 * 24h = 1.2h)

const sunAngleNight = -0.2; // Sun inclination during full night
const sunAngleHorizon = 0.0; // Sun inclination at horizon (sunrise/sunset peak)
const sunAnglePeak = 0.5; // Sun inclination at midday peak

const ground = MeshBuilder.CreateGround(
  "ground1",
  { width: 50, height: 50, subdivisions: 2 },
  scene
);
const groundMaterial = new StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
// Add sand texture
const sandTexture = new Texture("assets/textures/sand.png", scene);
groundMaterial.diffuseTexture = sandTexture;
(groundMaterial.diffuseTexture as any).uScale = 8; // Tile horizontally
(groundMaterial.diffuseTexture as any).vScale = 8; // Tile vertically
ground.material = groundMaterial;

const skyboxMaterial = new SkyMaterial("skyBoxMaterial", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.turbidity = 10;
skyboxMaterial.mieDirectionalG = 0.8;
skyboxMaterial.useSunPosition = true;
skyboxMaterial.azimuth = 0.25;
skyboxMaterial.luminance = 1.0;
skyboxMaterial.disableDepthWrite = true;

const nightSkyboxMaterial = new StandardMaterial("nightSkyboxMaterial", scene);
nightSkyboxMaterial.backFaceCulling = false;
nightSkyboxMaterial.reflectionTexture = new CubeTexture(
  "assets/skybox/night/bkg1",
  scene,
  ["_right.png", "_top.png", "_front.png", "_left.png", "_bot.png", "_back.png"]
);
nightSkyboxMaterial.reflectionTexture.coordinatesMode = 5;
nightSkyboxMaterial.disableLighting = true;
nightSkyboxMaterial.alpha = 0.0;
nightSkyboxMaterial.disableDepthWrite = true;

const daySkybox = MeshBuilder.CreateBox("daySkyBox", { size: 1000 }, scene);
daySkybox.material = skyboxMaterial;
daySkybox.infiniteDistance = true;

const nightSkybox = MeshBuilder.CreateBox("nightSkybox", { size: 1000 }, scene);
nightSkybox.material = nightSkyboxMaterial;
nightSkybox.infiniteDistance = true;

const wallHeight = 100;
const wallThickness = 0.1;
const groundSize = 50;
const wallPositions = [
  [0, groundSize / 2, groundSize, wallThickness],
  [0, -groundSize / 2, groundSize, wallThickness],
  [-groundSize / 2, 0, wallThickness, groundSize],
  [groundSize / 2, 0, wallThickness, groundSize],
];

// === MOON SETUP ===
const moonTexture = new Texture("assets/skybox/moon.png", scene);
const moonMaterial = new StandardMaterial("moonMaterial", scene);
moonMaterial.diffuseTexture = moonTexture;
moonMaterial.emissiveTexture = moonTexture;
moonMaterial.disableLighting = true;
moonMaterial.backFaceCulling = false;
moonMaterial.alpha = 1.0;
const moonPlane = MeshBuilder.CreatePlane("moonPlane", { size: 32 }, scene);
moonPlane.material = moonMaterial;
moonPlane.infiniteDistance = true;
moonPlane.isPickable = false;
moonPlane.alwaysSelectAsActiveMesh = false;
moonPlane.visibility = 0; // Start hidden
moonPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;

// Moonlight (dim directional light)
const moonLight = new DirectionalLight(
  "moonLight",
  new Vector3(0, -1, 0),
  scene
);
moonLight.intensity = 0;
moonLight.diffuse = new Color3(0.7, 0.8, 1.0);
moonLight.specular = new Color3(0.8, 0.9, 1.0);

async function loadAssetWithCollider(
  name: string,
  filePath: string,
  fileName: string,
  scene: Scene,
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
      filePath,
      fileName,
      scene
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
      scene
    );

    collider.isVisible = false;

    if (isDynamicCollider) {
      visualMesh.parent = collider;
      visualMesh.position = Vector3.Zero();
      collider.position = position;
    } else {
      visualMesh.parent = collider;
      visualMesh.position = Vector3.Zero();
      collider.position = position;
    }

    // Create PhysicsAggregate for the collider mesh
    const aggregate = new PhysicsAggregate(
      collider,
      PhysicsShapeType.BOX,
      {
        mass: isDynamicCollider ? 1 : 0,
        friction: 0.5,
        restitution: 0.1,
      },
      scene
    );

    if (onLoaded) onLoaded(collider, visualMesh);
    return { collider, visualMesh };
  } catch (error) {
    console.error(`Failed to load asset ${name}:`, error);
    return null;
  }
}

async function initializeGameAssets() {
  try {
    const spiderInstance = await Spider.Create(
      scene,
      new Vector3(20, 0, 20),
      defaultSpeed
    );
    spiders.push(spiderInstance);
    spiderInstance.setOnPlayerDamaged((damage: number) => {
      if (playerIsDead) return;
      currentHealth -= damage;
      if (bloodScreenEffect) {
        bloodScreenEffect.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
        bloodScreenEffect.style.opacity = "1";
        setTimeout(() => {
          bloodScreenEffect.style.opacity = "0";
        }, 200);
      }
      if (currentHealth < 0) currentHealth = 0;
    });
  } catch (error) {
    console.error("Failed to create spider:", error);
  }

  // Initialize Sword here
  playerSwordInstance = await Sword.Create(scene, camera, 15);
}

function updateStaminaBar(current: number, max: number) {
  if (staminaText && staminaBarFill) {
    staminaText.textContent = `${current.toFixed(0)}/${max.toFixed(0)}`;
    staminaBarFill.style.width = `${(current / max) * 100}%`;
  }
}

function updateHealthBar(current: number, max: number) {
  if (healthText && healthBarFill) {
    healthText.textContent = `${current.toFixed(0)}/${max.toFixed(0)}`;
    healthBarFill.style.width = `${(current / max) * 100}%`;
  }
}

function showDeathScreen() {
  deathScreen.classList.remove("hidden");
}

function respawnPlayer() {
  window.location.reload();
}

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000;

  /* === PLAYER CROUCH CAMERA ADJUSTMENT === */
  const targetCameraY = isCrouching
    ? crouchCameraPositionY
    : standCameraPositionY;
  const crouchLerpSpeed = 10; // How quickly the camera moves towards the target height (units per second)
  camera.position.y +=
    (targetCameraY - camera.position.y) *
    Math.min(1, crouchLerpSpeed * deltaTime);

  currentCycleTime = (currentCycleTime + deltaTime) % CYCLE_DURATION_SECONDS;
  const cycleProgress = currentCycleTime / CYCLE_DURATION_SECONDS;

  const currentDaySkyMaterial = daySkybox.material as SkyMaterial;
  const currentNightSkyMaterial = nightSkybox.material as StandardMaterial;

  // Target values, to be determined by cycleProgress
  let targetInclination: number;
  let targetHemisphericIntensity: number;
  let targetSunLightIntensity: number;
  let targetDaySkyLuminance: number;
  let targetNightSkyAlpha: number;

  const sr_transition_start = newSunrisePoint - dayNightTransitionWidth;
  const sr_transition_end = newSunrisePoint + dayNightTransitionWidth;
  const ss_transition_start = newSunsetPoint - dayNightTransitionWidth;
  const ss_transition_end = newSunsetPoint + dayNightTransitionWidth;

  if (
    cycleProgress >= sr_transition_start &&
    cycleProgress < sr_transition_end
  ) {
    // Sunrise Transition
    const transProgress =
      (cycleProgress - sr_transition_start) / (dayNightTransitionWidth * 2);
    targetInclination =
      sunAngleNight + transProgress * (sunAngleHorizon - sunAngleNight);
    targetHemisphericIntensity = 0.05 + transProgress * 0.65; // Night (0.05) to Day (0.7)
    targetSunLightIntensity = transProgress * 1.0; // Night (0) to Day (1.0)
    targetDaySkyLuminance = 0.005 + transProgress * (1.0 - 0.005); // Night (0.005) to Day (1.0)
    targetNightSkyAlpha = 1.0 - transProgress; // Night (1.0) to Day (0.0)
  } else if (
    cycleProgress >= ss_transition_start &&
    cycleProgress < ss_transition_end
  ) {
    // Sunset Transition
    const transProgress =
      (cycleProgress - ss_transition_start) / (dayNightTransitionWidth * 2);
    targetInclination =
      sunAngleHorizon - transProgress * (sunAngleHorizon - sunAngleNight); // Horizon to Night
    targetHemisphericIntensity = 0.7 - transProgress * 0.65; // Day (0.7) to Night (0.05)
    targetSunLightIntensity = 1.0 - transProgress * 1.0; // Day (1.0) to Night (0)
    targetDaySkyLuminance = 1.0 - transProgress * (1.0 - 0.005); // Day (1.0) to Night (0.005)
    targetNightSkyAlpha = transProgress; // Day (0.0) to Night (1.0)
  } else if (
    cycleProgress >= sr_transition_end &&
    cycleProgress < ss_transition_start
  ) {
    // Full Day (between sunrise and sunset transitions)
    targetHemisphericIntensity = 0.7;
    targetSunLightIntensity = 1.0;
    targetDaySkyLuminance = 1.0;
    targetNightSkyAlpha = 0.0;

    if (cycleProgress < newMiddayPoint) {
      // Morning: from end of sunrise transition to midday peak
      const morningProgress =
        (cycleProgress - sr_transition_end) /
        (newMiddayPoint - sr_transition_end);
      targetInclination =
        sunAngleHorizon + morningProgress * (sunAnglePeak - sunAngleHorizon);
    } else {
      // Afternoon: from midday peak to start of sunset transition
      const afternoonProgress =
        (cycleProgress - newMiddayPoint) /
        (ss_transition_start - newMiddayPoint);
      targetInclination =
        sunAnglePeak - afternoonProgress * (sunAnglePeak - sunAngleHorizon);
    }
    // Clamp inclination during day to avoid going below horizon if logic is imperfect
    targetInclination = Math.max(
      sunAngleHorizon,
      Math.min(sunAnglePeak, targetInclination)
    );
  } else {
    // Full Night (covers periods: after sunset_end up to 1.0, and from 0.0 up to sunrise_start)
    targetInclination = sunAngleNight;
    targetHemisphericIntensity = 0.05;
    targetSunLightIntensity = 0;
    targetDaySkyLuminance = 0.005;
    targetNightSkyAlpha = 1.0;
  }

  // Apply the calculated values
  currentDaySkyMaterial.inclination = targetInclination;
  light.intensity = targetHemisphericIntensity;
  sunLight.intensity = targetSunLightIntensity;
  currentDaySkyMaterial.luminance = targetDaySkyLuminance;
  currentNightSkyMaterial.alpha = targetNightSkyAlpha;

  if (currentDaySkyMaterial.useSunPosition) {
    const phi = currentDaySkyMaterial.inclination * Math.PI;
    const theta = currentDaySkyMaterial.azimuth * 2 * Math.PI;
    currentDaySkyMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
    currentDaySkyMaterial.sunPosition.y = Math.sin(phi);
    currentDaySkyMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);
    sunLight.direction = currentDaySkyMaterial.sunPosition.scale(-1);
  }

  let isAnyEnemyAggro = false;
  if (!playerIsDead) {
    spiders.forEach((spider) => {
      if (spider.currentHealth > 0) {
        spider.update(deltaTime, camera);
        if (spider.getIsAggro()) isAnyEnemyAggro = true;
      }
    });
  }

  if (isAnyEnemyAggro && !isInFightMode) {
    isInFightMode = true;
    if (fightMusic)
      fightMusic
        .play()
        .catch((e) => console.warn("Fight music play failed:", e));
  } else if (!isAnyEnemyAggro && isInFightMode) {
    isInFightMode = false;
    if (fightMusic) {
      fightMusic.pause();
      fightMusic.currentTime = 0;
    }
  }

  if (!playerIsDead && playerBodyAggregate && playerBodyAggregate.body) {
    // Player Movement with Physics
    const currentVelocity = playerBodyAggregate.body.getLinearVelocity();
    let targetVelocityXZ = Vector3.Zero();

    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());
    forward.y = 0; // Movement is horizontal
    right.y = 0; // Movement is horizontal
    forward.normalize();
    right.normalize();

    if (isMovingForward) targetVelocityXZ.addInPlace(forward);
    if (isMovingBackward) targetVelocityXZ.subtractInPlace(forward);
    if (isMovingLeft) targetVelocityXZ.subtractInPlace(right);
    if (isMovingRight) targetVelocityXZ.addInPlace(right);

    let actualSpeed = defaultSpeed;
    if (isSprinting && currentStamina > 0) {
      actualSpeed *= runSpeedMultiplier;
    }
    if (isCrouching) {
      actualSpeed *= crouchSpeedMultiplier;
    }

    if (targetVelocityXZ.lengthSquared() > 0.001) {
      // Check if there's input
      targetVelocityXZ.normalize().scaleInPlace(actualSpeed);
    } else {
      targetVelocityXZ = Vector3.Zero(); // No input, so no XZ movement from input
    }

    playerBodyAggregate.body.setLinearVelocity(
      new Vector3(targetVelocityXZ.x, currentVelocity.y, targetVelocityXZ.z)
    );

    // Stamina handling
    if (isSprinting && targetVelocityXZ.lengthSquared() > 0.001) {
      // Sprinting and moving
      if (currentStamina > 0)
        currentStamina -= staminaDepletionRate * deltaTime;
      if (currentStamina <= 0) {
        currentStamina = 0;
        isSprinting = false;
        // Speed will naturally reduce in next frame's calculation
      }
    } else {
      // Not sprinting or not moving
      if (currentStamina < maxStamina) {
        let currentRegenRate = staminaRegenerationRate;
        // Stamina regenerates only if not moving (or moving very slowly)
        if (
          isMovingForward ||
          isMovingBackward ||
          isMovingLeft ||
          isMovingRight
        ) {
          currentRegenRate = 0; // No regen while actively pressing movement keys
        }

        if (currentRegenRate > 0) {
          currentStamina += currentRegenRate * deltaTime;
        }
        if (currentStamina > maxStamina) currentStamina = maxStamina;
      }
    }
  } else if (playerIsDead && playerBodyAggregate && playerBodyAggregate.body) {
    // If player is dead, stop all movement
    playerBodyAggregate.body.setLinearVelocity(Vector3.Zero());
  }

  updateStaminaBar(currentStamina, maxStamina);
  updateHealthBar(currentHealth, maxHealth);

  if (currentHealth <= 0 && !playerIsDead) {
    playerIsDead = true;
    camera.inputs.clear();
    console.log("Player has died.");
    showDeathScreen();
    if (isInFightMode && fightMusic) {
      fightMusic.pause();
      fightMusic.currentTime = 0;
      isInFightMode = false;
    }
  }

  if (playerIsDead && keyRPressed) {
    respawnPlayer();
  }

  camera.computeWorldMatrix(); // Force update of camera's world matrix
  const rayOrigin = camera.globalPosition; // Get the camera's absolute position
  const forwardDirection = camera.getDirection(Vector3.Forward()); // Get the camera's forward direction
  const ray = new Ray(rayOrigin, forwardDirection, crosshairMaxDistance); // Create the ray

  // RayHelper.CreateAndShow(ray, scene, new Color3(1, 1, 0));

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
    if (pickedMesh.metadata && pickedMesh.metadata.enemyType === "spider") {
      lookingAtEnemy = true;
      enemyInfoContainer.style.display = "block";
      crosshairElement.classList.add("crosshair-enemy-focus");
      if (crosshairElement) crosshairElement.textContent = "💢";
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
      }
    } else if (
      pickedMesh.metadata &&
      pickedMesh.metadata.interactableType === "chest"
    ) {
      lookingAtInteractable = true;
      const chestInstance = pickedMesh.metadata.chestInstance as ClosedChest;
      if (crosshairElement) {
        crosshairElement.textContent = chestInstance.getDisplayIcon();
        crosshairElement.classList.remove("crosshair-enemy-focus");
      }
      enemyInfoContainer.style.display = "none";
    }
  }
  if (!lookingAtEnemy && !lookingAtInteractable) {
    enemyInfoContainer.style.display = "none";
    crosshairElement.classList.remove("crosshair-enemy-focus");
    if (crosshairElement) crosshairElement.textContent = "•";
  }

  // === MOON POSITION & VISIBILITY ===
  // Use unclamped inclination for moon's orbit
  const unclampedInclination = (() => {
    if (
      cycleProgress >= sr_transition_start &&
      cycleProgress < sr_transition_end
    ) {
      // Sunrise Transition
      const transProgress =
        (cycleProgress - sr_transition_start) / (dayNightTransitionWidth * 2);
      return sunAngleNight + transProgress * (sunAngleHorizon - sunAngleNight);
    } else if (
      cycleProgress >= ss_transition_start &&
      cycleProgress < ss_transition_end
    ) {
      // Sunset Transition
      const transProgress =
        (cycleProgress - ss_transition_start) / (dayNightTransitionWidth * 2);
      return (
        sunAngleHorizon - transProgress * (sunAngleHorizon - sunAngleNight)
      );
    } else if (
      cycleProgress >= sr_transition_end &&
      cycleProgress < ss_transition_start
    ) {
      // Full Day
      if (cycleProgress < newMiddayPoint) {
        const morningProgress =
          (cycleProgress - sr_transition_end) /
          (newMiddayPoint - sr_transition_end);
        return (
          sunAngleHorizon + morningProgress * (sunAnglePeak - sunAngleHorizon)
        );
      } else {
        const afternoonProgress =
          (cycleProgress - newMiddayPoint) /
          (ss_transition_start - newMiddayPoint);
        return (
          sunAnglePeak - afternoonProgress * (sunAnglePeak - sunAngleHorizon)
        );
      }
    } else {
      // Full Night
      return sunAngleNight;
    }
  })();
  const moonPhi = (unclampedInclination + 1) * Math.PI; // Always full orbit
  const moonTheta = (skyboxMaterial.azimuth + 0.5) * 2 * Math.PI;
  const moonDistance = 400;
  const moonPos = new Vector3(
    Math.cos(moonPhi) * Math.sin(moonTheta) * moonDistance,
    Math.sin(moonPhi) * moonDistance,
    Math.cos(moonPhi) * Math.cos(moonTheta) * moonDistance
  );
  moonPlane.position = moonPos;
  // Fade moon in/out at night transitions
  let moonVisibility = 0;
  let moonLightIntensity = 0;
  if (targetNightSkyAlpha > 0.01) {
    moonVisibility = Math.min(1, targetNightSkyAlpha * 1.2);
    moonLightIntensity = 0.4 * moonVisibility; // Brighter moonlight
  }
  moonPlane.visibility = moonVisibility;
  moonLight.intensity = moonLightIntensity;
  moonMaterial.emissiveColor = new Color3(1, 1, 1);
  light.intensity = targetHemisphericIntensity * (1 - 0.5 * moonVisibility);

  scene.render();
  if (fpsDisplay) fpsDisplay.textContent = "FPS: " + engine.getFps().toFixed();
});

window.addEventListener("resize", () => {
  engine.resize();
});

document.addEventListener("DOMContentLoaded", () => {
  const tabMenu = document.getElementById("tab-menu") as HTMLElement;
  const mainUiContainer = document.querySelector(
    ".ui-container"
  ) as HTMLElement;
  const fpsDisp = document.getElementById("fpsDisplay") as HTMLElement;
  const enemyInfoCont = document.getElementById(
    "enemyInfoContainer"
  ) as HTMLElement;
  const crosshair = document.getElementById("crosshair") as HTMLElement;

  const tabNavigation = document.getElementById(
    "tab-navigation"
  ) as HTMLElement;
  const tabButtons = Array.from(
    tabNavigation.querySelectorAll(".tab-button")
  ) as HTMLButtonElement[];
  const tabPanes = document.querySelectorAll(
    "#tab-menu-content .tab-pane"
  ) as NodeListOf<HTMLElement>;

  const playerLevelDisplay = document.getElementById(
    "player-level"
  ) as HTMLElement;
  const playerHealthDisplay = document.getElementById(
    "player-health"
  ) as HTMLElement;
  const playerStaminaDisplay = document.getElementById(
    "player-stamina"
  ) as HTMLElement;
  const playerExperienceDisplay = document.getElementById(
    "player-experience"
  ) as HTMLElement;
  const experienceBarFillTab = document.getElementById(
    "experience-bar-fill-tab"
  ) as HTMLElement;
  const ingameTimeDisplayTab = document.getElementById(
    "ingame-time-tab"
  ) as HTMLElement;

  let isTabMenuOpen = false;
  let currentActiveTab = "player-stats-tab";

  const tabPlayerData = { level: 1, experienceToNextLevel: 1000 };

  if (canvas) {
    canvas.addEventListener("click", () => {
      if (!isTabMenuOpen && !engine.isPointerLock) engine.enterPointerlock();
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
    const placeholderCurrentExp = 250;

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

    if (ingameTimeDisplayTab) {
      const cycleProgressForTab = currentCycleTime / CYCLE_DURATION_SECONDS;
      const totalGameSecondsInDay = 86400;
      const currentTotalGameSeconds =
        cycleProgressForTab * totalGameSecondsInDay;
      const gameHours = Math.floor(currentTotalGameSeconds / 3600) % 24;
      const gameMinutes = Math.floor((currentTotalGameSeconds % 3600) / 60);
      ingameTimeDisplayTab.textContent = `${gameHours
        .toString()
        .padStart(2, "0")}:${gameMinutes.toString().padStart(2, "0")}`;
    }
    if (experienceBarFillTab) {
      experienceBarFillTab.style.width = `${
        (placeholderCurrentExp / tabPlayerData.experienceToNextLevel) * 100
      }%`;
    }
  }

  function setActiveTab(tabId: string) {
    currentActiveTab = tabId;
    tabButtons.forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === tabId)
    );
    tabPanes.forEach((pane) =>
      pane.classList.toggle("active", pane.id === tabId)
    );
    if (tabId === "player-stats-tab") updateStatsTabData();
  }

  function openTabMenu(tabIdToShow?: string) {
    isTabMenuOpen = true;
    tabMenu.classList.remove("hidden");
    [mainUiContainer, fpsDisp, enemyInfoCont, crosshair].forEach((el) =>
      el.classList.add("hidden")
    );
    if (engine.isPointerLock) engine.exitPointerlock();
    setActiveTab(tabIdToShow || currentActiveTab || "player-stats-tab");
  }

  function closeTabMenu() {
    isTabMenuOpen = false;
    tabMenu.classList.add("hidden");
    [mainUiContainer, fpsDisp, enemyInfoCont, crosshair].forEach((el) =>
      el.classList.remove("hidden")
    );
  }

  function toggleTabMenu(tabIdToShow?: string) {
    if (isTabMenuOpen && (!tabIdToShow || tabIdToShow === currentActiveTab))
      closeTabMenu();
    else openTabMenu(tabIdToShow);
  }

  tabButtons.forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.tab) setActiveTab(button.dataset.tab);
    })
  );

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "tab") {
      event.preventDefault();
      toggleTabMenu();
    }
    if (event.key.toLowerCase() === "escape") {
      if (engine.isPointerLock) engine.exitPointerlock();
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
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

  if (tabMenu) tabMenu.classList.add("hidden");
  setActiveTab(currentActiveTab);
});

function handleConsoleCommand(command: string): void {
  if (!command) {
    return;
  }

  const lowerCommand = command.toLowerCase();

  if (lowerCommand.startsWith("set_time ")) {
    const timeString = command.substring("set_time ".length);
    const timeParts = timeString.split(":");
    if (timeParts.length === 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      if (
        !isNaN(hours) &&
        !isNaN(minutes) &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
      ) {
        const totalMinutesInDay = 1440;
        const inputTotalMinutes = hours * 60 + minutes;
        const targetCycleProgress = inputTotalMinutes / totalMinutesInDay;
        currentCycleTime = targetCycleProgress * CYCLE_DURATION_SECONDS;
        console.log(
          `Game time set to ${String(hours).padStart(2, "0")}:${String(
            minutes
          ).padStart(2, "0")}`
        );

        // Apply the same lighting logic as in runRenderLoop
        const currentDaySkyMaterial = daySkybox.material as SkyMaterial;
        const currentNightSkyMaterial =
          nightSkybox.material as StandardMaterial;

        let targetInclinationUpdate: number;
        let targetHemisphericIntensityUpdate: number;
        let targetSunLightIntensityUpdate: number;
        let targetDaySkyLuminanceUpdate: number;
        let targetNightSkyAlphaUpdate: number;

        const sr_transition_start = newSunrisePoint - dayNightTransitionWidth;
        const sr_transition_end = newSunrisePoint + dayNightTransitionWidth;
        const ss_transition_start = newSunsetPoint - dayNightTransitionWidth;
        const ss_transition_end = newSunsetPoint + dayNightTransitionWidth;

        if (
          targetCycleProgress >= sr_transition_start &&
          targetCycleProgress < sr_transition_end
        ) {
          // Sunrise Transition
          const transProgress =
            (targetCycleProgress - sr_transition_start) /
            (dayNightTransitionWidth * 2);
          targetInclinationUpdate =
            sunAngleNight + transProgress * (sunAngleHorizon - sunAngleNight);
          targetHemisphericIntensityUpdate = 0.05 + transProgress * 0.65;
          targetSunLightIntensityUpdate = transProgress * 1.0;
          targetDaySkyLuminanceUpdate = 0.005 + transProgress * (1.0 - 0.005);
          targetNightSkyAlphaUpdate = 1.0 - transProgress;
        } else if (
          targetCycleProgress >= ss_transition_start &&
          targetCycleProgress < ss_transition_end
        ) {
          // Sunset Transition
          const transProgress =
            (targetCycleProgress - ss_transition_start) /
            (dayNightTransitionWidth * 2);
          targetInclinationUpdate =
            sunAngleHorizon - transProgress * (sunAngleHorizon - sunAngleNight);
          targetHemisphericIntensityUpdate = 0.7 - transProgress * 0.65;
          targetSunLightIntensityUpdate = 1.0 - transProgress * 1.0;
          targetDaySkyLuminanceUpdate = 1.0 - transProgress * (1.0 - 0.005);
          targetNightSkyAlphaUpdate = transProgress;
        } else if (
          targetCycleProgress >= sr_transition_end &&
          targetCycleProgress < ss_transition_start
        ) {
          // Full Day
          targetHemisphericIntensityUpdate = 0.7;
          targetSunLightIntensityUpdate = 1.0;
          targetDaySkyLuminanceUpdate = 1.0;
          targetNightSkyAlphaUpdate = 0.0;

          if (targetCycleProgress < newMiddayPoint) {
            const morningProgress =
              (targetCycleProgress - sr_transition_end) /
              (newMiddayPoint - sr_transition_end);
            targetInclinationUpdate =
              sunAngleHorizon +
              morningProgress * (sunAnglePeak - sunAngleHorizon);
          } else {
            const afternoonProgress =
              (targetCycleProgress - newMiddayPoint) /
              (ss_transition_start - newMiddayPoint);
            targetInclinationUpdate =
              sunAnglePeak -
              afternoonProgress * (sunAnglePeak - sunAngleHorizon);
          }
          targetInclinationUpdate = Math.max(
            sunAngleHorizon,
            Math.min(sunAnglePeak, targetInclinationUpdate)
          );
        } else {
          // Full Night
          targetInclinationUpdate = sunAngleNight;
          targetHemisphericIntensityUpdate = 0.05;
          targetSunLightIntensityUpdate = 0;
          targetDaySkyLuminanceUpdate = 0.005;
          targetNightSkyAlphaUpdate = 1.0;
        }

        currentDaySkyMaterial.inclination = targetInclinationUpdate;
        light.intensity = targetHemisphericIntensityUpdate;
        sunLight.intensity = targetSunLightIntensityUpdate;
        currentDaySkyMaterial.luminance = targetDaySkyLuminanceUpdate;
        currentNightSkyMaterial.alpha = targetNightSkyAlphaUpdate;

        if (currentDaySkyMaterial.useSunPosition) {
          const phi = currentDaySkyMaterial.inclination * Math.PI;
          const theta = currentDaySkyMaterial.azimuth * 2 * Math.PI;
          currentDaySkyMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
          currentDaySkyMaterial.sunPosition.y = Math.sin(phi);
          currentDaySkyMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);
          sunLight.direction = currentDaySkyMaterial.sunPosition.scale(-1);
        }
      } else {
        console.error(
          "Invalid time format or value for set_time. Use HH:MM (00:00 - 23:59)."
        );
      }
    }
  } else if (lowerCommand === "enable_debug") {
    scene.debugLayer.show();
  } else {
    console.log(`Unknown command: ${command}`);
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key === "/" || event.key === "~") {
    event.preventDefault();
    const input = window.prompt("Enter command:");
    if (input) {
      handleConsoleCommand(input);
    }
  }
});

deathScreen.classList.add("hidden");

async function setupGameAndPhysics() {
  console.log("Attempting to initialize Havok Physics...");
  // 1. Initialize Havok Physics Engine
  try {
    havokInstance = await HavokPhysics({
      locateFile: (file) => {
        // Attempt to load directly from a conventionally served node_modules path
        if (file.endsWith(".wasm")) {
          const wasmPath =
            "/node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm";
          console.log(
            `Havok locateFile: attempting to load WASM from ${wasmPath}`
          );
          return wasmPath;
        }
        return file;
      },
    });
  } catch (e) {
    console.error(
      "Havok physics engine failed to load or an error occurred during init:",
      e
    );
    // Optionally, fall back to a different physics engine or show an error message.
    // For now, we'll just log and potentially not enable physics.
    // To prevent further errors, we can return early or set a flag.
    return;
  }

  if (!havokInstance) {
    console.error(
      "Havok physics engine could not be initialized (HavokPhysics() returned null/undefined)."
    );
    return;
  }

  const havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);

  // 2. Setup Ground with Physics (ground mesh is already created globally)
  const groundAggregate = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    { mass: 0, friction: 0.5, restitution: 0.1 },
    scene
  );

  // 3. Setup Walls with Physics
  wallPositions.forEach((props, i) => {
    const wall = MeshBuilder.CreateBox(
      `wall${i + 1}`,
      { width: props[2], height: wallHeight, depth: props[3] },
      scene
    );
    wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
    wall.isVisible = false; // Keep them invisible
    const wallAggregate = new PhysicsAggregate(
      wall,
      PhysicsShapeType.BOX,
      { mass: 0, friction: 0.5, restitution: 0.1 },
      scene
    );
  });

  // 4. Setup Player (Camera) Physics
  const playerStartPos = new Vector3(0, 1.0, -5); // Base of the capsule on the ground
  const playerEyeHeightOffset = 0.6;

  playerBodyMesh = MeshBuilder.CreateCapsule(
    "playerBody",
    { radius: playerRadius, height: playerHeight, tessellation: 20 },
    scene
  );
  playerBodyMesh.position = playerStartPos.clone();
  playerBodyMesh.position.y = playerStartPos.y + playerHeight / 2;
  playerBodyMesh.isVisible = false; // The physics body is invisible

  playerBodyAggregate = new PhysicsAggregate(
    playerBodyMesh,
    PhysicsShapeType.CAPSULE,
    {
      mass: 1,
      friction: 0.7,
      restitution: 0.1,
      // Define capsule explicitly with pointA, pointB, and radius for PhysicsAggregate
      pointA: new Vector3(0, -(playerHeight / 2 - playerRadius), 0), // Bottom sphere center
      pointB: new Vector3(0, playerHeight / 2 - playerRadius, 0), // Top sphere center
      radius: playerRadius,
    },
    scene
  );

  if (playerBodyAggregate.body) {
    playerBodyAggregate.body.setMassProperties({
      inertia: new Vector3(0, 0, 0),
    }); // Prevent capsule from falling over
  } else {
    console.error("Failed to create physics body for player.");
  }

  // Parent the camera to the playerBodyMesh
  camera.parent = playerBodyMesh;
  camera.position = new Vector3(0, playerEyeHeightOffset, 0); // Eye position relative to playerBodyMesh center
  // If playerBodyMesh center is at playerHeight/2,
  // and eye is at ~0.9 * playerHeight from base, then relative offset is
  // (0.9 * H) - H/2 = 0.4 * H. For H=1.6, this is 0.64.
  // Let's use a simpler fixed offset for now.

  // 5. Load Static Assets with Colliders (PhysicsAggregate)
  // These calls are now made after physics is initialized
  await loadAssetWithCollider(
    "palmTree1",
    "assets/models/pirate_kit/",
    "palm_tree1.glb",
    scene,
    new Vector3(10, 0, 10),
    new Vector3(2, 2, 2),
    false, // isDynamic
    undefined,
    3.0,
    undefined,
    3.0
  );
  await loadAssetWithCollider(
    "palmTree2",
    "assets/models/pirate_kit/",
    "palm_tree2.glb",
    scene,
    new Vector3(5, 0, 15),
    new Vector3(1.8, 1.8, 1.8),
    false, // isDynamic
    undefined,
    2.7,
    undefined,
    2.7
  );
  await loadAssetWithCollider(
    "palmTree3",
    "assets/models/pirate_kit/",
    "palm_tree3.glb",
    scene,
    new Vector3(-5, 0, 15),
    new Vector3(2.2, 2.2, 2.2),
    false, //isDynamic
    undefined,
    3.3,
    undefined,
    3.3
  );

  await loadAssetWithCollider(
    "chestClosed",
    "assets/models/pirate_kit/",
    "chest_closed.glb",
    scene,
    new Vector3(18, 0, 18),
    new Vector3(1, 1, 1),
    false, // isDynamicCollider = false for a static chest
    (collider) => {
      new ClosedChest(collider as Mesh, true, "key_old_chest", () => {
        if (collider.metadata && collider.metadata.chestInstance) {
          const ray = camera.getForwardRay(crosshairMaxDistance);
          const pickInfo = scene.pickWithRay(ray, (mesh) => mesh === collider);
          if (pickInfo && pickInfo.hit && crosshairElement) {
            crosshairElement.textContent =
              collider.metadata.chestInstance.getDisplayIcon();
          }
        }
      });
    },
    2.25,
    2.25,
    2.25
  );

  // 6. Initialize Dynamic Game Assets (Spiders, Sword)
  await initializeGameAssets(); // This function will need to be aware of physics for spiders
  // Sword is parented to camera, likely no physics body for sword itself for now.

  scene.onPointerDown = (evt) => {
    if (
      evt.button === 0 &&
      playerSwordInstance &&
      !playerIsDead &&
      !playerSwordInstance.getIsSwinging()
    ) {
      playerSwordInstance.swing(
        crosshairMaxDistance,
        (mesh) => mesh.metadata && mesh.metadata.enemyType === "spider",
        (_targetMesh, instance) => {
          const spiderInstance = instance as Spider;
          if (
            spiderInstance &&
            spiderInstance.currentHealth > 0 &&
            playerSwordInstance
          ) {
            spiderInstance.takeDamage(playerSwordInstance.attackDamage);
          }
        }
      );
    }
  };
}

// Call the main setup function
setupGameAndPhysics().catch((error) => {
  console.error("Error during game and physics setup:", error);
});
