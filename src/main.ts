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
import { Chest, registerChest } from "./interactables";

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
const deathScreen = document.getElementById("deathScreen") as HTMLElement;

if (crosshairElement) {
  crosshairElement.textContent = "•";
}

const engine = new Engine(canvas, false, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});

const scene = new Scene(engine);

let spiders: Spider[] = [];
let playerSword: AbstractMesh | null = null;
let isSwinging = false;

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
console.log(
  "Camera minZ (initial):",
  camera.minZ,
  "Camera maxZ (initial):",
  camera.maxZ
);
camera.maxZ = 10000;
console.log(
  "Camera minZ (updated):",
  camera.minZ,
  "Camera maxZ (updated):",
  camera.maxZ
);
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
let isShiftPressed = false;

let maxHealth = 100;
let currentHealth = maxHealth;
let playerIsDead = false;
let keyRPressed = false;

const playerAttackDamage = 15;

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
    isShiftPressed = true;
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
    isShiftPressed = false;
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
  onLoaded?: (collider: AbstractMesh, visual: AbstractMesh) => void
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

    const colliderWidth = dimensions.x > 0 ? dimensions.x : 0.1;
    const colliderHeight = dimensions.y > 0 ? dimensions.y : 0.1;
    const colliderDepth = dimensions.z > 0 ? dimensions.z : 0.1;

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
  new Vector3(2, 2, 2)
);
loadAssetWithCollider(
  "palmTree2",
  "assets/models/pirate_kit/",
  "palm_tree2.glb",
  scene,
  new Vector3(5, 0, 15),
  new Vector3(1.8, 1.8, 1.8)
);
loadAssetWithCollider(
  "palmTree3",
  "assets/models/pirate_kit/",
  "palm_tree3.glb",
  scene,
  new Vector3(-5, 0, 15),
  new Vector3(2.2, 2.2, 2.2)
);

loadAssetWithCollider(
  "chestClosed",
  "assets/models/pirate_kit/",
  "chest_closed.glb",
  scene,
  new Vector3(18, 0, 18),
  new Vector3(1, 1, 1),
  false,
  (collider, visual) => {
    const gameChest = new Chest(collider as Mesh, true, "key_old_chest", () => {
      console.log("The old chest was opened!");
      if (collider.metadata && collider.metadata.chestInstance) {
        const ray = camera.getForwardRay(crosshairMaxDistance);
        const pickInfo = scene.pickWithRay(ray, (mesh) => mesh === collider);
        if (pickInfo && pickInfo.hit && crosshairElement) {
          crosshairElement.textContent =
            collider.metadata.chestInstance.getDisplayIcon();
        }
      }
    });
    registerChest(gameChest);
  }
);

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "sword.glb",
  scene
).then((result) => {
  const swordMesh = result.meshes[0];
  if (swordMesh) {
    playerSword = swordMesh;
    playerSword.name = "playerSword";
    playerSword.parent = camera;
    playerSword.position = new Vector3(0.35, -0.35, 1.2);
    playerSword.rotationQuaternion = null;
    playerSword.rotation = new Vector3(0, Math.PI / 12 + Math.PI / 2, 0);
    playerSword.scaling = new Vector3(0.7, 0.7, 0.7);
    playerSword.receiveShadows = false;
    playerSword.renderingGroupId = 1;
    playerSword.getChildMeshes().forEach((mesh) => {
      mesh.receiveShadows = false;
      mesh.checkCollisions = false;
      mesh.renderingGroupId = 1;
    });
    swordMesh.checkCollisions = false;
    swordMesh.renderingGroupId = 1;
  }
});

const swingAnimation = new Animation(
  "swordSwing",
  "rotation.z",
  30,
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CONSTANT
);

scene.onPointerDown = (evt) => {
  if (evt.button === 0 && playerSword && !isSwinging && !playerIsDead) {
    isSwinging = true;
    const initialRotationZ = playerSword.rotation.z;
    const swingAngle = Math.PI / 3;
    const swingKeysDynamic = [
      { frame: 0, value: initialRotationZ },
      { frame: 5, value: initialRotationZ + swingAngle },
      { frame: 15, value: initialRotationZ },
    ];
    swingAnimation.setKeys(swingKeysDynamic);

    setTimeout(() => {
      if (!playerSword || playerIsDead) return;
      const ray = camera.getForwardRay(crosshairMaxDistance);
      const pickInfo = scene.pickWithRay(
        ray,
        (mesh) => mesh.metadata && mesh.metadata.enemyType === "spider"
      );
      if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
        const spiderInstance = pickInfo.pickedMesh.metadata.instance as Spider;
        if (spiderInstance && spiderInstance.currentHealth > 0) {
          spiderInstance.takeDamage(playerAttackDamage);
        }
      }
    }, 150);

    scene.beginDirectAnimation(
      playerSword,
      [swingAnimation],
      0,
      15,
      false,
      1,
      () => {
        isSwinging = false;
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
}

(async () => {
  await initializeGameAssets();
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
  if (deathScreen) {
    deathScreen.classList.remove("hidden");
  }
}

function hideDeathScreen() {
  if (deathScreen) {
    deathScreen.classList.add("hidden");
  }
}

function respawnPlayer() {
  playerIsDead = false;
  currentHealth = maxHealth;
  currentStamina = maxStamina;
  hideDeathScreen();
  camera.attachControl(canvas, true);
  camera.position = new Vector3(0, 1.6, -5);
  console.log("Player respawned.");
}

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000;
  currentCycleTime = (currentCycleTime + deltaTime) % CYCLE_DURATION_SECONDS;
  const cycleProgress = currentCycleTime / CYCLE_DURATION_SECONDS;

  const currentDaySkyMaterial = daySkybox.material as SkyMaterial;
  const currentNightSkyMaterial = nightSkybox.material as StandardMaterial;
  let currentInclination;
  const dayNightTransition = 0.05;
  let dayLuminance = currentDaySkyMaterial.luminance;
  let nightAlpha = currentNightSkyMaterial.alpha;

  if (cycleProgress >= 0 && cycleProgress < 0.25 - dayNightTransition) {
    currentInclination = -0.2;
    light.intensity = 0.05;
    sunLight.intensity = 0;
    dayLuminance = 0.005;
    nightAlpha = 1.0;
  } else if (cycleProgress < 0.25 + dayNightTransition) {
    const transProgress =
      (cycleProgress - (0.25 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = -0.2 + transProgress * 0.2;
    light.intensity = 0.05 + transProgress * 0.65;
    sunLight.intensity = transProgress * 1.0;
    dayLuminance = 0.005 + transProgress * (1.0 - 0.005);
    nightAlpha = 1.0 - transProgress;
  } else if (cycleProgress < 0.5 - dayNightTransition) {
    const dayProgress =
      (cycleProgress - (0.25 + dayNightTransition)) /
      (0.5 - dayNightTransition - (0.25 + dayNightTransition));
    currentInclination = dayProgress * 0.5;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
    dayLuminance = 1.0;
    nightAlpha = 0.0;
  } else if (cycleProgress < 0.5 + dayNightTransition) {
    currentInclination = 0.5;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
    dayLuminance = 1.0;
    nightAlpha = 0.0;
  } else if (cycleProgress < 0.75 - dayNightTransition) {
    const afternoonProgress =
      (cycleProgress - (0.5 + dayNightTransition)) /
      (0.75 - dayNightTransition - (0.5 + dayNightTransition));
    currentInclination = 0.5 - afternoonProgress * 0.5;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
    dayLuminance = 1.0;
    nightAlpha = 0.0;
  } else if (cycleProgress < 0.75 + dayNightTransition) {
    const transProgress =
      (cycleProgress - (0.75 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = 0.0 - transProgress * 0.2;
    light.intensity = 0.7 - transProgress * 0.65;
    sunLight.intensity = 1.0 - transProgress * 1.0;
    dayLuminance = 1.0 - transProgress * (1.0 - 0.005);
    nightAlpha = transProgress;
  } else {
    currentInclination = -0.2;
    light.intensity = 0.05;
    sunLight.intensity = 0;
    dayLuminance = 0.005;
    nightAlpha = 1.0;
  }
  currentDaySkyMaterial.luminance = dayLuminance;
  currentNightSkyMaterial.alpha = nightAlpha;
  currentDaySkyMaterial.inclination = currentInclination;

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
        const chestInstance = pickedMesh.metadata.chestInstance as Chest;
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
  const tabMenu = document.getElementById("tab-menu") as HTMLElement | null;
  const mainUiContainer = document.querySelector(
    ".ui-container"
  ) as HTMLElement | null;
  const fpsDisp = document.getElementById("fpsDisplay") as HTMLElement | null;
  const enemyInfoCont = document.getElementById(
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
    if (!tabMenu) return;
    isTabMenuOpen = true;
    tabMenu.classList.remove("hidden");
    [mainUiContainer, fpsDisp, enemyInfoCont, crosshair].forEach((el) =>
      el?.classList.add("hidden")
    );
    if (engine.isPointerLock) engine.exitPointerlock();
    setActiveTab(tabIdToShow || currentActiveTab || "player-stats-tab");
  }

  function closeTabMenu() {
    if (!tabMenu) return;
    isTabMenuOpen = false;
    tabMenu.classList.add("hidden");
    [mainUiContainer, fpsDisp, enemyInfoCont, crosshair].forEach((el) =>
      el?.classList.remove("hidden")
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

function handleConsoleCommand(command: string | null): void {
  if (!command) return;
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

        const currentDaySkyMaterial = daySkybox.material as SkyMaterial;
        const currentNightSkyMaterial =
          nightSkybox.material as StandardMaterial;
        let currentInclinationUpdate;
        const dayNightTransitionUpdate = 0.05;
        let dayLuminanceUpdate;
        let nightAlphaUpdate;

        if (
          targetCycleProgress >= 0 &&
          targetCycleProgress < 0.25 - dayNightTransitionUpdate
        ) {
          currentInclinationUpdate = -0.2;
          light.intensity = 0.05;
          sunLight.intensity = 0;
          dayLuminanceUpdate = 0.005;
          nightAlphaUpdate = 1.0;
        } else if (targetCycleProgress < 0.25 + dayNightTransitionUpdate) {
          const transProgress =
            (targetCycleProgress - (0.25 - dayNightTransitionUpdate)) /
            (dayNightTransitionUpdate * 2);
          currentInclinationUpdate = -0.2 + transProgress * 0.2;
          light.intensity = 0.05 + transProgress * 0.65;
          sunLight.intensity = transProgress * 1.0;
          dayLuminanceUpdate = 0.005 + transProgress * (1.0 - 0.005);
          nightAlphaUpdate = 1.0 - transProgress;
        } else if (targetCycleProgress < 0.5 - dayNightTransitionUpdate) {
          const dayProgress =
            (targetCycleProgress - (0.25 + dayNightTransitionUpdate)) /
            (0.5 -
              dayNightTransitionUpdate -
              (0.25 + dayNightTransitionUpdate));
          currentInclinationUpdate = dayProgress * 0.5;
          light.intensity = 0.7;
          sunLight.intensity = 1.0;
          dayLuminanceUpdate = 1.0;
          nightAlphaUpdate = 0.0;
        } else if (targetCycleProgress < 0.5 + dayNightTransitionUpdate) {
          currentInclinationUpdate = 0.5;
          light.intensity = 0.7;
          sunLight.intensity = 1.0;
          dayLuminanceUpdate = 1.0;
          nightAlphaUpdate = 0.0;
        } else if (targetCycleProgress < 0.75 - dayNightTransitionUpdate) {
          const afternoonProgress =
            (targetCycleProgress - (0.5 + dayNightTransitionUpdate)) /
            (0.75 -
              dayNightTransitionUpdate -
              (0.5 + dayNightTransitionUpdate));
          currentInclinationUpdate = 0.5 - afternoonProgress * 0.5;
          light.intensity = 0.7;
          sunLight.intensity = 1.0;
          dayLuminanceUpdate = 1.0;
          nightAlphaUpdate = 0.0;
        } else if (targetCycleProgress < 0.75 + dayNightTransitionUpdate) {
          const transProgress =
            (targetCycleProgress - (0.75 - dayNightTransitionUpdate)) /
            (dayNightTransitionUpdate * 2);
          currentInclinationUpdate = 0.0 - transProgress * 0.2;
          light.intensity = 0.7 - transProgress * 0.65;
          sunLight.intensity = 1.0 - transProgress * 1.0;
          dayLuminanceUpdate = 1.0 - transProgress * (1.0 - 0.005);
          nightAlphaUpdate = transProgress;
        } else {
          currentInclinationUpdate = -0.2;
          light.intensity = 0.05;
          sunLight.intensity = 0;
          dayLuminanceUpdate = 0.005;
          nightAlphaUpdate = 1.0;
        }
        currentDaySkyMaterial.luminance = dayLuminanceUpdate;
        currentNightSkyMaterial.alpha = nightAlphaUpdate;
        currentDaySkyMaterial.inclination = currentInclinationUpdate;
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
    } else {
      console.error("Invalid time format for set_time. Use HH:MM.");
    }
  } else {
    console.log(`Unknown command: ${command}`);
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key === "/" || event.key === "~") {
    event.preventDefault();
    const input = window.prompt("Enter command:");
    handleConsoleCommand(input);
  }
});

if (deathScreen) {
  deathScreen.classList.add("hidden");
}

console.log("Game initialized. Watch for player death and skybox transitions.");
