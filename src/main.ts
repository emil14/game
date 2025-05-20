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

import { ClosedChest } from "./interactables";
import { Spider } from "./enemies/spider";
import { Sword } from "./weapons/sword";

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

let spiders: Spider[] = [];
let playerSwordInstance: Sword | null = null;

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
camera.maxZ = 10000;
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);

const crosshairMaxDistance = 30;

camera.ellipsoid = new Vector3(0.5, 0.8, 0.5);
camera.checkCollisions = true;
camera.applyGravity = true;
camera.speed = 2.0;
const defaultSpeed = camera.speed;
const runSpeedMultiplier = 2.0;
camera.angularSensibility = 2000;
camera.inertia = 0;

let isCrouching = false;
const crouchSpeedMultiplier = 0.5;
const crouchCameraPositionY = 1.0;
const standCameraPositionY = 1.6;

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

camera.keysUp.push(87);
camera.keysDown.push(83);
camera.keysLeft.push(65);
camera.keysRight.push(68);

let isSprinting = false;

window.addEventListener("keydown", (event) => {
  const keyCode = event.keyCode;

  if (keyCode === 16) {
    if (currentStamina > 0 && !isSprinting && !playerIsDead) {
      isSprinting = true;
      camera.speed = isCrouching
        ? defaultSpeed
        : defaultSpeed * runSpeedMultiplier;
    }
  } else if (keyCode === 87) isMovingForward = true;
  else if (keyCode === 83) isMovingBackward = true;
  else if (keyCode === 65) isMovingLeft = true;
  else if (keyCode === 68) isMovingRight = true;
  else if (keyCode === 67 && !playerIsDead) {
    isCrouching = !isCrouching;
    camera.position.y = isCrouching
      ? crouchCameraPositionY
      : standCameraPositionY;
    camera.ellipsoid = isCrouching
      ? new Vector3(0.5, 0.5, 0.5)
      : new Vector3(0.5, 0.8, 0.5);
    if (isSprinting) {
      camera.speed = isCrouching
        ? defaultSpeed
        : defaultSpeed * runSpeedMultiplier;
    } else {
      camera.speed = isCrouching
        ? defaultSpeed * crouchSpeedMultiplier
        : defaultSpeed;
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
      camera.speed = isCrouching
        ? defaultSpeed * crouchSpeedMultiplier
        : defaultSpeed;
    }
  } else if (keyCode === 87) isMovingForward = false;
  else if (keyCode === 83) isMovingBackward = false;
  else if (keyCode === 65) isMovingLeft = false;
  else if (keyCode === 68) isMovingRight = false;
  else if (keyCode === 82) {
    keyRPressed = false;
  }
});

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
ground.checkCollisions = true;
const groundMaterial = new StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
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

const nightSkybox = MeshBuilder.CreateBox("nightSkyBox", { size: 1000 }, scene);
nightSkybox.material = nightSkyboxMaterial;
nightSkybox.infiniteDistance = true;

const wallHeight = 100;
const wallThickness = 0.1;
const groundSize = 50;
[
  [0, groundSize / 2, groundSize, wallThickness],
  [0, -groundSize / 2, groundSize, wallThickness],
  [-groundSize / 2, 0, wallThickness, groundSize],
  [groundSize / 2, 0, wallThickness, groundSize],
].forEach((props, i) => {
  const wall = MeshBuilder.CreateBox(
    `wall${i + 1}`,
    { width: props[2], height: wallHeight, depth: props[3] },
    scene
  );
  wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
  wall.checkCollisions = true;
  wall.isVisible = false;
});

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

    collider.position = boundingInfo.min.add(dimensions.scale(0.5));
    collider.checkCollisions = true;
    collider.isVisible = false;

    if (isDynamicCollider) {
      visualMesh.parent = collider;
      visualMesh.position = position.subtract(collider.position);
    } else {
      visualMesh.parent = collider;
      visualMesh.position = Vector3.Zero();
      collider.position = position;
    }

    if (onLoaded) onLoaded(collider, visualMesh);
    return { collider, visualMesh };
  } catch (error) {
    console.error(`Failed to load asset ${name}:`, error);
    return null;
  }
}

loadAssetWithCollider(
  "palmTree1",
  "assets/models/pirate_kit/",
  "palm_tree1.glb",
  scene,
  new Vector3(10, 0, 10),
  new Vector3(2, 2, 2),
  false,
  undefined,
  3.0,
  undefined,
  3.0
);
loadAssetWithCollider(
  "palmTree2",
  "assets/models/pirate_kit/",
  "palm_tree2.glb",
  scene,
  new Vector3(5, 0, 15),
  new Vector3(1.8, 1.8, 1.8),
  false,
  undefined,
  2.7,
  undefined,
  2.7
);
loadAssetWithCollider(
  "palmTree3",
  "assets/models/pirate_kit/",
  "palm_tree3.glb",
  scene,
  new Vector3(-5, 0, 15),
  new Vector3(2.2, 2.2, 2.2),
  false,
  undefined,
  3.3,
  undefined,
  3.3
);

loadAssetWithCollider(
  "chestClosed",
  "assets/models/pirate_kit/",
  "chest_closed.glb",
  scene,
  new Vector3(18, 0, 18),
  new Vector3(1, 1, 1),
  false,
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

(async () => {
  await initializeGameAssets(); // Ensure assets, including sword, are loaded before game loop starts
})();

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

  if (!playerIsDead) {
    if (isSprinting) {
      if (currentStamina > 0)
        currentStamina -= staminaDepletionRate * deltaTime;
      if (currentStamina <= 0) {
        currentStamina = 0;
        isSprinting = false;
        camera.speed = isCrouching
          ? defaultSpeed * crouchSpeedMultiplier
          : defaultSpeed;
      }
    } else {
      if (currentStamina < maxStamina) {
        let currentRegenRate = staminaRegenerationRate;
        if (
          isMovingForward ||
          isMovingBackward ||
          isMovingLeft ||
          isMovingRight
        )
          currentRegenRate = 0;
        if (currentRegenRate > 0)
          currentStamina += currentRegenRate * deltaTime;
        if (currentStamina > maxStamina) currentStamina = maxStamina;
      }
    }
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

  if (
    enemyInfoContainer &&
    enemyHealthText &&
    enemyHealthBarFill &&
    enemyNameText &&
    enemyLevelText &&
    crosshairElement
  ) {
    const ray = camera.getForwardRay(crosshairMaxDistance);
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
  }

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
