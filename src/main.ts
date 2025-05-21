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

import { ClosedChest } from "./interactables";
import { Spider } from "./enemies/spider";
import { Sword } from "./weapons/sword";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  UI_ELEMENT_IDS,
  PLAYER_CONFIG,
  CAMERA_CONFIG,
  WORLD_CONFIG,
  ASSET_PATHS,
  PHYSICS_CONFIG,
  KEY_MAPPINGS,
  GAME_SETTINGS,
  TAB_MENU_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";

const canvas = document.getElementById(
  UI_ELEMENT_IDS.RENDER_CANVAS
)! as HTMLCanvasElement;
const inputManager = new InputManager(canvas);
const fpsDisplay = document.getElementById(
  UI_ELEMENT_IDS.FPS_DISPLAY
)! as HTMLElement;
const staminaText = document.getElementById(
  UI_ELEMENT_IDS.STAMINA_TEXT
)! as HTMLElement;
const staminaBarFill = document.getElementById(
  UI_ELEMENT_IDS.STAMINA_BAR_FILL
)! as HTMLElement;
const healthText = document.getElementById(
  UI_ELEMENT_IDS.HEALTH_TEXT
)! as HTMLElement;
const healthBarFill = document.getElementById(
  UI_ELEMENT_IDS.HEALTH_BAR_FILL
)! as HTMLElement;
const bloodScreenEffect = document.getElementById(
  UI_ELEMENT_IDS.BLOOD_SCREEN_EFFECT
)! as HTMLElement;
const enemyInfoContainer = document.getElementById(
  UI_ELEMENT_IDS.ENEMY_INFO_CONTAINER
)! as HTMLElement;
const enemyHealthText = document.getElementById(
  UI_ELEMENT_IDS.ENEMY_HEALTH_TEXT
)! as HTMLElement;
const enemyHealthBarFill = document.getElementById(
  UI_ELEMENT_IDS.ENEMY_HEALTH_BAR_FILL
)! as HTMLElement;
const enemyNameText = document.getElementById(
  UI_ELEMENT_IDS.ENEMY_NAME_TEXT
)! as HTMLElement;
const enemyLevelText = document.getElementById(
  UI_ELEMENT_IDS.ENEMY_LEVEL_TEXT
)! as HTMLElement;
const crosshairElement = document.getElementById(
  UI_ELEMENT_IDS.CROSSHAIR
)! as HTMLElement;
const fightMusic = document.getElementById(
  UI_ELEMENT_IDS.FIGHT_MUSIC
) as HTMLAudioElement | null;
const deathScreen = document.getElementById(
  UI_ELEMENT_IDS.DEATH_SCREEN
)! as HTMLElement;

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

let isDebugModeEnabled = GAME_SETTINGS.DEBUG_START_MODE;
let debugRayHelper: RayHelper | null = null;

const camera = new FreeCamera(
  "camera1",
  new Vector3(0, CAMERA_CONFIG.STAND_CAMERA_Y, -5),
  scene
);
camera.maxZ = CAMERA_CONFIG.MAX_Z;
camera.setTarget(Vector3.Zero());
camera.attachControl(canvas, true);
camera.inputs.remove(camera.inputs.attached.keyboard);

const crosshairMaxDistance = PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE;

const defaultSpeed = PLAYER_CONFIG.DEFAULT_SPEED;
const runSpeedMultiplier = PLAYER_CONFIG.RUN_SPEED_MULTIPLIER;
camera.angularSensibility = CAMERA_CONFIG.ANGULAR_SENSIBILITY;
camera.inertia = CAMERA_CONFIG.INERTIA;

let isCrouching = false;
const crouchSpeedMultiplier = PLAYER_CONFIG.CROUCH_SPEED_MULTIPLIER;
const crouchCameraPositionY = CAMERA_CONFIG.CROUCH_CAMERA_Y;
const standCameraPositionY = CAMERA_CONFIG.STAND_CAMERA_Y;

const jumpForce = PLAYER_CONFIG.JUMP_FORCE;
const jumpStaminaCost = PLAYER_CONFIG.JUMP_STAMINA_COST;
const groundCheckDistance = PHYSICS_CONFIG.GROUND_CHECK_DISTANCE;

const playerHeight = PLAYER_CONFIG.PLAYER_HEIGHT;
const playerRadius = PLAYER_CONFIG.PLAYER_RADIUS;

let maxStamina = PLAYER_CONFIG.MAX_STAMINA;
let currentStamina = maxStamina;
const staminaDepletionRate = PLAYER_CONFIG.STAMINA_DEPLETION_RATE;
const staminaRegenerationRate = PLAYER_CONFIG.STAMINA_REGENERATION_RATE;

let maxHealth = PLAYER_CONFIG.MAX_HEALTH;
let currentHealth = maxHealth;
let playerIsDead = false;

let isMovingForward = false;
let isMovingBackward = false;
let isMovingLeft = false;
let isMovingRight = false;
let isSprinting = false;

let crouchKeyPressedLastFrame = false;
let jumpKeyPressedLastFrame = false;

let isInFightMode = false;

function isPlayerOnGroundCheck(
  playerMesh: Mesh,
  sceneRef: Scene,
  checkDistance: number,
  pHeight: number,
  _pRadius: number
): boolean {
  if (!playerMesh || !playerBodyAggregate || !playerBodyAggregate.body) {
    return false;
  }
  const rayOrigin = playerMesh.getAbsolutePosition().clone();
  const rayLength = pHeight / 2 + checkDistance;
  const ray = new Ray(rayOrigin, Vector3.Down(), rayLength);
  const pickInfo = sceneRef.pickWithRay(
    ray,
    (mesh) =>
      mesh !== playerMesh &&
      mesh.isPickable &&
      mesh.isEnabled() &&
      !mesh.name.toLowerCase().includes("spider") &&
      mesh.getTotalVertices() > 0
  );
  return pickInfo?.hit || false;
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
playerLight.intensity = CAMERA_CONFIG.PLAYER_LIGHT_INTENSITY;
playerLight.range = CAMERA_CONFIG.PLAYER_LIGHT_RANGE;
playerLight.diffuse = new Color3(1, 0.9, 0.7);
playerLight.parent = camera;

const CYCLE_DURATION_SECONDS = WORLD_CONFIG.CYCLE_DURATION_SECONDS;
let currentCycleTime =
  CYCLE_DURATION_SECONDS * WORLD_CONFIG.INITIAL_CYCLE_TIME_PROGRESS;

const NEW_SUNRISE_HOUR = WORLD_CONFIG.NEW_SUNRISE_HOUR;
const NEW_SUNSET_HOUR = WORLD_CONFIG.NEW_SUNSET_HOUR;
const newSunrisePoint = NEW_SUNRISE_HOUR / 24;
const newSunsetPoint = NEW_SUNSET_HOUR / 24;
const newMiddayPoint = (newSunrisePoint + newSunsetPoint) / 2;
const dayNightTransitionWidth =
  WORLD_CONFIG.DAY_NIGHT_TRANSITION_WIDTH_HOURS_PORTION;
const sunAngleNight = WORLD_CONFIG.SUN_ANGLE_NIGHT;
const sunAngleHorizon = WORLD_CONFIG.SUN_ANGLE_HORIZON;
const sunAnglePeak = WORLD_CONFIG.SUN_ANGLE_PEAK;

const ground = MeshBuilder.CreateGround(
  "ground1",
  {
    width: WORLD_CONFIG.GROUND_SIZE,
    height: WORLD_CONFIG.GROUND_SIZE,
    subdivisions: 2,
  },
  scene
);
const groundMaterial = new StandardMaterial("groundMaterial", scene);
groundMaterial.diffuseColor = new Color3(0.9, 0.8, 0.6);
const sandTexture = new Texture(ASSET_PATHS.SAND_TEXTURE, scene);
groundMaterial.diffuseTexture = sandTexture;
(groundMaterial.diffuseTexture as any).uScale = 8;
(groundMaterial.diffuseTexture as any).vScale = 8;
ground.material = groundMaterial;

const skyboxMaterial = new SkyMaterial("skyBoxMaterial", scene);
skyboxMaterial.backFaceCulling = false;
skyboxMaterial.turbidity = WORLD_CONFIG.SKYBOX_TURBIDITY;
skyboxMaterial.mieDirectionalG = WORLD_CONFIG.SKYBOX_MIE_DIRECTIONAL_G;
skyboxMaterial.useSunPosition = true;
skyboxMaterial.azimuth = WORLD_CONFIG.SKYBOX_AZIMUTH;
skyboxMaterial.luminance = WORLD_CONFIG.SKYBOX_LUMINANCE;
skyboxMaterial.disableDepthWrite = true;

const nightSkyboxMaterial = new StandardMaterial("nightSkyboxMaterial", scene);
nightSkyboxMaterial.backFaceCulling = false;
nightSkyboxMaterial.reflectionTexture = new CubeTexture(
  ASSET_PATHS.SKYBOX_NIGHT,
  scene,
  [
    "_right.webp",
    "_top.webp",
    "_front.webp",
    "_left.webp",
    "_bot.webp",
    "_back.webp",
  ]
);
if (nightSkyboxMaterial.reflectionTexture) {
  nightSkyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
}
nightSkyboxMaterial.disableLighting = true;
nightSkyboxMaterial.alpha = 0.0;
nightSkyboxMaterial.disableDepthWrite = true;

const daySkybox = MeshBuilder.CreateBox(
  "daySkyBox",
  { size: WORLD_CONFIG.GROUND_SIZE * 20 },
  scene
);
daySkybox.material = skyboxMaterial;
daySkybox.infiniteDistance = true;

const nightSkybox = MeshBuilder.CreateBox(
  "nightSkybox",
  { size: WORLD_CONFIG.GROUND_SIZE * 20 },
  scene
);
nightSkybox.material = nightSkyboxMaterial;
nightSkybox.infiniteDistance = true;

const wallHeight = WORLD_CONFIG.WALL_HEIGHT;
const wallThickness = WORLD_CONFIG.WALL_THICKNESS;
const groundSize = WORLD_CONFIG.GROUND_SIZE;
const wallPositions = [
  [0, groundSize / 2, groundSize, wallThickness],
  [0, -groundSize / 2, groundSize, wallThickness],
  [-groundSize / 2, 0, wallThickness, groundSize],
  [groundSize / 2, 0, wallThickness, groundSize],
];

const moonTexture = new Texture(ASSET_PATHS.MOON_TEXTURE, scene);
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
moonPlane.visibility = 0;
moonPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;

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
  filePathKey: keyof typeof ASSET_PATHS,
  fileNameKey: keyof typeof ASSET_PATHS,
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
      ASSET_PATHS[filePathKey],
      ASSET_PATHS[fileNameKey],
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
      PLAYER_CONFIG.DEFAULT_SPEED
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

  isMovingForward = inputManager.isKeyPressed(KEY_MAPPINGS.FORWARD);
  isMovingBackward = inputManager.isKeyPressed(KEY_MAPPINGS.BACKWARD);
  isMovingLeft = inputManager.isKeyPressed(KEY_MAPPINGS.LEFT);
  isMovingRight = inputManager.isKeyPressed(KEY_MAPPINGS.RIGHT);

  const shiftPressed = inputManager.isKeyCodePressed("ShiftLeft");
  if (shiftPressed && currentStamina > 0 && !playerIsDead) {
    isSprinting = true;
  } else {
    isSprinting = false;
  }

  const crouchKeyCurrentlyPressed = inputManager.isKeyPressed(
    KEY_MAPPINGS.CROUCH
  );
  if (
    crouchKeyCurrentlyPressed &&
    !crouchKeyPressedLastFrame &&
    !playerIsDead
  ) {
    isCrouching = !isCrouching;
  }
  crouchKeyPressedLastFrame = crouchKeyCurrentlyPressed;

  if (playerIsDead && inputManager.isKeyPressed(KEY_MAPPINGS.RESPAWN)) {
    respawnPlayer();
  }

  if (
    inputManager.isMouseButtonPressed(0) &&
    playerSwordInstance &&
    !playerIsDead &&
    !playerSwordInstance.getIsSwinging()
  ) {
    playerSwordInstance.swing(
      PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE,
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

  const targetCameraY = isCrouching
    ? crouchCameraPositionY
    : standCameraPositionY;
  const crouchLerpSpeed = 10;
  camera.position.y +=
    (targetCameraY - camera.position.y) *
    Math.min(1, crouchLerpSpeed * deltaTime);

  currentCycleTime = (currentCycleTime + deltaTime) % CYCLE_DURATION_SECONDS;
  const cycleProgress = currentCycleTime / CYCLE_DURATION_SECONDS;
  const currentDaySkyMaterial = daySkybox.material as SkyMaterial;
  const currentNightSkyMaterial = nightSkybox.material as StandardMaterial;
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
    const transProgress =
      (cycleProgress - sr_transition_start) / (dayNightTransitionWidth * 2);
    targetInclination =
      sunAngleNight + transProgress * (sunAngleHorizon - sunAngleNight);
    targetHemisphericIntensity = 0.05 + transProgress * 0.65;
    targetSunLightIntensity = transProgress * 1.0;
    targetDaySkyLuminance = 0.005 + transProgress * (1.0 - 0.005);
    targetNightSkyAlpha = 1.0 - transProgress;
  } else if (
    cycleProgress >= ss_transition_start &&
    cycleProgress < ss_transition_end
  ) {
    const transProgress =
      (cycleProgress - ss_transition_start) / (dayNightTransitionWidth * 2);
    targetInclination =
      sunAngleHorizon - transProgress * (sunAngleHorizon - sunAngleNight);
    targetHemisphericIntensity = 0.7 - transProgress * 0.65;
    targetSunLightIntensity = 1.0 - transProgress * 1.0;
    targetDaySkyLuminance = 1.0 - transProgress * (1.0 - 0.005);
    targetNightSkyAlpha = transProgress;
  } else if (
    cycleProgress >= sr_transition_end &&
    cycleProgress < ss_transition_start
  ) {
    targetHemisphericIntensity = 0.7;
    targetSunLightIntensity = 1.0;
    targetDaySkyLuminance = 1.0;
    targetNightSkyAlpha = 0.0;
    if (cycleProgress < newMiddayPoint) {
      const morningProgress =
        (cycleProgress - sr_transition_end) /
        (newMiddayPoint - sr_transition_end);
      targetInclination =
        sunAngleHorizon + morningProgress * (sunAnglePeak - sunAngleHorizon);
    } else {
      const afternoonProgress =
        (cycleProgress - newMiddayPoint) /
        (ss_transition_start - newMiddayPoint);
      targetInclination =
        sunAnglePeak - afternoonProgress * (sunAnglePeak - sunAngleHorizon);
    }
    targetInclination = Math.max(
      sunAngleHorizon,
      Math.min(sunAnglePeak, targetInclination)
    );
  } else {
    targetInclination = sunAngleNight;
    targetHemisphericIntensity = 0.05;
    targetSunLightIntensity = 0;
    targetDaySkyLuminance = 0.005;
    targetNightSkyAlpha = 1.0;
  }

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
    const currentPhysicsVelocity = playerBodyAggregate.body.getLinearVelocity();
    let finalVelocity = new Vector3(0, currentPhysicsVelocity.y, 0);

    let targetVelocityXZ = Vector3.Zero();
    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    if (isMovingForward) targetVelocityXZ.addInPlace(forward);
    if (isMovingBackward) targetVelocityXZ.subtractInPlace(forward);
    if (isMovingLeft) targetVelocityXZ.subtractInPlace(right);
    if (isMovingRight) targetVelocityXZ.addInPlace(right);

    let actualSpeed = defaultSpeed;
    if (isSprinting) {
      actualSpeed *= runSpeedMultiplier;
    }
    if (isCrouching) {
      actualSpeed *= crouchSpeedMultiplier;
    }

    if (targetVelocityXZ.lengthSquared() > 0.001) {
      targetVelocityXZ.normalize().scaleInPlace(actualSpeed);
      finalVelocity.x = targetVelocityXZ.x;
      finalVelocity.z = targetVelocityXZ.z;
    } else {
      finalVelocity.x = 0;
      finalVelocity.z = 0;
    }

    const jumpKeyCurrentlyPressed = inputManager.isKeyPressed(
      KEY_MAPPINGS.JUMP
    );
    if (jumpKeyCurrentlyPressed && !jumpKeyPressedLastFrame && !playerIsDead) {
      const isOnGround = isPlayerOnGroundCheck(
        playerBodyMesh,
        scene,
        groundCheckDistance,
        playerHeight,
        playerRadius
      );
      if (currentStamina >= jumpStaminaCost && isOnGround) {
        finalVelocity.y = jumpForce;
        currentStamina -= jumpStaminaCost;
        updateStaminaBar(currentStamina, maxStamina);
      }
    }
    jumpKeyPressedLastFrame = jumpKeyCurrentlyPressed;

    playerBodyAggregate.body.setLinearVelocity(finalVelocity);

    if (isSprinting && targetVelocityXZ.lengthSquared() > 0.001) {
      if (currentStamina > 0)
        currentStamina -= staminaDepletionRate * deltaTime;
      if (currentStamina <= 0) {
        currentStamina = 0;
        isSprinting = false;
      }
    } else {
      if (currentStamina < maxStamina) {
        let currentRegenRate = staminaRegenerationRate;
        if (
          !isSprinting &&
          (isMovingForward || isMovingBackward || isMovingLeft || isMovingRight)
        ) {
          currentRegenRate = 0;
        }
        if (currentRegenRate > 0) {
          currentStamina += currentRegenRate * deltaTime;
        }
        if (currentStamina > maxStamina) currentStamina = maxStamina;
      }
    }
  } else if (playerIsDead && playerBodyAggregate && playerBodyAggregate.body) {
    playerBodyAggregate.body.setLinearVelocity(Vector3.Zero());
  }

  updateStaminaBar(currentStamina, maxStamina);
  updateHealthBar(currentHealth, maxHealth);

  if (currentHealth <= 0 && !playerIsDead) {
    playerIsDead = true;
    console.log("Player has died.");
    showDeathScreen();
    if (isInFightMode && fightMusic) {
      fightMusic.pause();
      fightMusic.currentTime = 0;
      isInFightMode = false;
    }
  }

  camera.computeWorldMatrix();
  const rayOrigin = camera.globalPosition;
  const forwardDirection = camera.getDirection(Vector3.Forward());
  const ray = new Ray(rayOrigin, forwardDirection, crosshairMaxDistance);

  if (isDebugModeEnabled) {
    if (!debugRayHelper) {
      debugRayHelper = RayHelper.CreateAndShow(ray, scene, new Color3(1, 1, 0));
    } else {
      debugRayHelper.ray = ray;
    }
  } else {
    if (debugRayHelper) {
      debugRayHelper.dispose();
      debugRayHelper = null;
    }
  }

  const pickInfo = scene.pickWithRay(
    ray,
    (mesh) =>
      (mesh.metadata && mesh.metadata.enemyType === "spider") ||
      (mesh.metadata && mesh.metadata.interactableType)
  );
  let crosshairSetForSpecificTarget = false;

  if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
    const pickedMesh = pickInfo.pickedMesh;
    if (pickedMesh.metadata && pickedMesh.metadata.enemyType === "spider") {
      const spiderInstance = pickedMesh.metadata.instance as Spider;
      if (
        spiderInstance &&
        (spiderInstance.getIsDying() || spiderInstance.currentHealth <= 0)
      ) {
        if (crosshairElement) crosshairElement.textContent = "✋";
        crosshairElement.classList.remove("crosshair-enemy-focus");
        enemyInfoContainer.style.display = "none";
        crosshairSetForSpecificTarget = true;
      } else if (spiderInstance) {
        enemyInfoContainer.style.display = "block";
        crosshairElement.classList.add("crosshair-enemy-focus");
        if (crosshairElement) crosshairElement.textContent = "💢";
        enemyNameText.textContent = spiderInstance.name;
        enemyLevelText.textContent = `| Lvl ${spiderInstance.level}`;
        enemyHealthText.textContent = `${spiderInstance.currentHealth.toFixed(
          0
        )}/${spiderInstance.maxHealth}`;
        enemyHealthBarFill.style.width = `${
          (spiderInstance.currentHealth / spiderInstance.maxHealth) * 100
        }%`;
        crosshairSetForSpecificTarget = true;
      }
    } else if (
      pickedMesh.metadata &&
      pickedMesh.metadata.interactableType === "chest"
    ) {
      const chestInstance = pickedMesh.metadata.chestInstance as ClosedChest;
      if (crosshairElement) {
        crosshairElement.textContent = chestInstance.getDisplayIcon();
        crosshairElement.classList.remove("crosshair-enemy-focus");
      }
      enemyInfoContainer.style.display = "none";
      crosshairSetForSpecificTarget = true;
    }
  }
  if (!crosshairSetForSpecificTarget) {
    enemyInfoContainer.style.display = "none";
    crosshairElement.classList.remove("crosshair-enemy-focus");
    if (crosshairElement) crosshairElement.textContent = "•";
  }

  const unclampedInclination = (() => {
    if (
      cycleProgress >= sr_transition_start &&
      cycleProgress < sr_transition_end
    ) {
      const transProgress =
        (cycleProgress - sr_transition_start) / (dayNightTransitionWidth * 2);
      return sunAngleNight + transProgress * (sunAngleHorizon - sunAngleNight);
    } else if (
      cycleProgress >= ss_transition_start &&
      cycleProgress < ss_transition_end
    ) {
      const transProgress =
        (cycleProgress - ss_transition_start) / (dayNightTransitionWidth * 2);
      return (
        sunAngleHorizon - transProgress * (sunAngleHorizon - sunAngleNight)
      );
    } else if (
      cycleProgress >= sr_transition_end &&
      cycleProgress < ss_transition_start
    ) {
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
      return sunAngleNight;
    }
  })();
  const moonPhi = (unclampedInclination + 1) * Math.PI;
  const moonTheta = (skyboxMaterial.azimuth + 0.5) * 2 * Math.PI;
  const moonDistance = WORLD_CONFIG.MOON_DISTANCE_FROM_CAMERA;
  const moonPos = new Vector3(
    Math.cos(moonPhi) * Math.sin(moonTheta) * moonDistance,
    Math.sin(moonPhi) * moonDistance,
    Math.cos(moonPhi) * Math.cos(moonTheta) * moonDistance
  );
  moonPlane.position = moonPos;
  let moonVisibility = 0;
  let moonLightIntensity = 0;
  if (targetNightSkyAlpha > 0.01) {
    moonVisibility = Math.min(1, targetNightSkyAlpha * 1.2);
    moonLightIntensity = 0.4 * moonVisibility;
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
  const tabMenu = document.getElementById(
    UI_ELEMENT_IDS.TAB_MENU
  )! as HTMLElement;
  const mainUiContainer = document.querySelector(
    "." + UI_ELEMENT_IDS.UI_CONTAINER
  ) as HTMLElement | null;
  const fpsDisp = document.getElementById(
    UI_ELEMENT_IDS.FPS_DISPLAY
  )! as HTMLElement;
  const enemyInfoCont = document.getElementById(
    UI_ELEMENT_IDS.ENEMY_INFO_CONTAINER
  )! as HTMLElement;
  const crosshair = document.getElementById(
    UI_ELEMENT_IDS.CROSSHAIR
  )! as HTMLElement;

  const tabNavigation = document.getElementById(
    UI_ELEMENT_IDS.TAB_NAVIGATION
  )! as HTMLElement;
  const tabButtons = Array.from(
    tabNavigation.querySelectorAll(".tab-button")
  ) as HTMLButtonElement[];
  const tabPanes = document.querySelectorAll(
    "#tab-menu-content .tab-pane"
  ) as NodeListOf<HTMLElement>;

  const playerLevelDisplay = document.getElementById(
    UI_ELEMENT_IDS.PLAYER_LEVEL_TAB
  )! as HTMLElement;
  const playerHealthDisplay = document.getElementById(
    UI_ELEMENT_IDS.PLAYER_HEALTH_TAB
  )! as HTMLElement;
  const playerStaminaDisplay = document.getElementById(
    UI_ELEMENT_IDS.PLAYER_STAMINA_TAB
  )! as HTMLElement;
  const playerExperienceDisplay = document.getElementById(
    UI_ELEMENT_IDS.PLAYER_EXPERIENCE_TAB
  )! as HTMLElement;
  const experienceBarFillTab = document.getElementById(
    UI_ELEMENT_IDS.EXPERIENCE_BAR_FILL_TAB
  )! as HTMLElement;
  const ingameTimeDisplayTab = document.getElementById(
    UI_ELEMENT_IDS.INGAME_TIME_TAB
  )! as HTMLElement;

  let isTabMenuOpen = false;
  let currentActiveTab = TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB;

  const tabPlayerData = {
    level: TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_LEVEL,
    experienceToNextLevel: TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_EXP_TO_NEXT_LEVEL,
  };

  if (canvas) {
    canvas.addEventListener("click", () => {
      if (!isTabMenuOpen && !engine.isPointerLock) engine.enterPointerlock();
    });
  }

  function updateStatsTabData() {
    if (
      !tabMenu ||
      tabMenu.classList.contains("hidden") ||
      currentActiveTab !== TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID
    )
      return;
    const currentHealthGame =
      typeof currentHealth !== "undefined"
        ? currentHealth
        : PLAYER_CONFIG.MAX_HEALTH;
    const maxHealthGame =
      typeof maxHealth !== "undefined" ? maxHealth : PLAYER_CONFIG.MAX_HEALTH;
    const currentStaminaGame =
      typeof currentStamina !== "undefined"
        ? currentStamina
        : PLAYER_CONFIG.MAX_STAMINA;
    const maxStaminaGame =
      typeof maxStamina !== "undefined"
        ? maxStamina
        : PLAYER_CONFIG.MAX_STAMINA;
    const placeholderCurrentExp =
      TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_CURRENT_EXP;

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
    if (tabId === TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID) updateStatsTabData();
  }

  function openTabMenu(tabIdToShow?: string) {
    isTabMenuOpen = true;
    tabMenu.classList.remove("hidden");
    [mainUiContainer, fpsDisp, enemyInfoCont, crosshair].forEach((el) =>
      el?.classList.add("hidden")
    );
    if (engine.isPointerLock) engine.exitPointerlock();
    setActiveTab(
      tabIdToShow || currentActiveTab || TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB
    );
  }

  function closeTabMenu() {
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
    const key = event.key.toLowerCase();
    if (key === KEY_MAPPINGS.OPEN_TAB_MENU) {
      toggleTabMenu();
    }
    if (key === KEY_MAPPINGS.EXIT_POINTER_LOCK) {
      if (engine.isPointerLock) engine.exitPointerlock();
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      switch (key) {
        case KEY_MAPPINGS.OPEN_INVENTORY_TAB:
          event.preventDefault();
          toggleTabMenu(TAB_MENU_CONFIG.INVENTORY_TAB_ID);
          break;
        case KEY_MAPPINGS.OPEN_JOURNAL_TAB:
          event.preventDefault();
          toggleTabMenu(TAB_MENU_CONFIG.JOURNAL_TAB_ID);
          break;
        case KEY_MAPPINGS.OPEN_MAP_TAB:
          event.preventDefault();
          toggleTabMenu(TAB_MENU_CONFIG.MAP_TAB_ID);
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
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_INSPECTOR) {
    scene.debugLayer.show();
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_DEBUG) {
    isDebugModeEnabled = !isDebugModeEnabled;
    console.log(`Debug mode ${isDebugModeEnabled ? "enabled" : "disabled"}.`);
    if (playerBodyMesh) {
      playerBodyMesh.isVisible = isDebugModeEnabled;
    }
    for (let i = 1; i <= 4; i++) {
      const wall = scene.getMeshByName(`wall${i}`);
      if (wall) {
        wall.isVisible = isDebugModeEnabled;
      }
    }
    scene.meshes.forEach((mesh) => {
      let processedAsSpiderColliderParent = false;
      if (
        mesh.metadata &&
        mesh.metadata.enemyType === "spider" &&
        mesh.parent &&
        mesh.parent instanceof AbstractMesh
      ) {
        (mesh.parent as AbstractMesh).isVisible = isDebugModeEnabled;
        processedAsSpiderColliderParent = true;
      }
      if (
        !processedAsSpiderColliderParent &&
        mesh.name.toLowerCase().endsWith("collider") &&
        mesh !== playerBodyMesh &&
        !mesh.name.startsWith("wall")
      ) {
        mesh.isVisible = isDebugModeEnabled;
      }
    });
  } else {
    console.log(`Unknown command: ${command}`);
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === KEY_MAPPINGS.TOGGLE_CONSOLE || (event.shiftKey && key === "~")) {
    const input = window.prompt("Enter command:");
    if (input) {
      handleConsoleCommand(input);
    }
  }
});

deathScreen.classList.add("hidden");

async function setupGameAndPhysics() {
  console.log("Attempting to initialize Havok Physics...");
  try {
    havokInstance = await HavokPhysics({
      locateFile: (file: string) => {
        if (file.endsWith(".wasm")) {
          const wasmPath = PHYSICS_CONFIG.HAVOK_WASM_PATH;
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
    return;
  }
  if (!havokInstance) {
    console.error(
      "Havok physics engine could not be initialized (HavokPhysics() returned null/undefined)."
    );
    return;
  }
  const havokPlugin = new HavokPlugin(true, havokInstance);
  scene.enablePhysics(new Vector3(0, PHYSICS_CONFIG.GRAVITY_Y, 0), havokPlugin);
  const groundAggregate = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    {
      mass: 0,
      friction: PHYSICS_CONFIG.GROUND_FRICTION,
      restitution: PHYSICS_CONFIG.GROUND_RESTITUTION,
    },
    scene
  );
  wallPositions.forEach((props, i) => {
    const wall = MeshBuilder.CreateBox(
      `wall${i + 1}`,
      { width: props[2], height: wallHeight, depth: props[3] },
      scene
    );
    wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
    wall.isVisible = false;
    const wallAggregate = new PhysicsAggregate(
      wall,
      PhysicsShapeType.BOX,
      {
        mass: 0,
        friction: PHYSICS_CONFIG.WALL_FRICTION,
        restitution: PHYSICS_CONFIG.WALL_RESTITUTION,
      },
      scene
    );
  });

  const playerStartPos = new Vector3(0, 1.0, -5);
  const playerEyeHeightOffset = PLAYER_CONFIG.PLAYER_EYE_HEIGHT_OFFSET;
  playerBodyMesh = MeshBuilder.CreateCapsule(
    "playerBody",
    { radius: playerRadius, height: playerHeight, tessellation: 20 },
    scene
  );
  playerBodyMesh.position = playerStartPos.clone();
  playerBodyMesh.position.y = playerStartPos.y + playerHeight / 2;
  playerBodyMesh.isVisible = false;
  playerBodyAggregate = new PhysicsAggregate(
    playerBodyMesh,
    PhysicsShapeType.CAPSULE,
    {
      mass: PLAYER_CONFIG.PLAYER_MASS,
      friction: PLAYER_CONFIG.PLAYER_FRICTION,
      restitution: PLAYER_CONFIG.PLAYER_RESTITUTION,
      pointA: new Vector3(0, -(playerHeight / 2 - playerRadius), 0),
      pointB: new Vector3(0, playerHeight / 2 - playerRadius, 0),
      radius: playerRadius,
    },
    scene
  );
  if (playerBodyAggregate.body) {
    playerBodyAggregate.body.setMassProperties({
      inertia: new Vector3(0, 0, 0),
    });
  } else {
    console.error("Failed to create physics body for player.");
  }
  camera.parent = playerBodyMesh;
  camera.position = new Vector3(0, playerEyeHeightOffset, 0);

  await loadAssetWithCollider(
    "palmTree1",
    "PIRATE_KIT_MODELS",
    "PALM_TREE_1_GLB",
    scene,
    new Vector3(10, 0, 10),
    new Vector3(2, 2, 2),
    false,
    undefined,
    3.0,
    undefined,
    3.0
  );
  await loadAssetWithCollider(
    "palmTree2",
    "PIRATE_KIT_MODELS",
    "PALM_TREE_2_GLB",
    scene,
    new Vector3(5, 0, 15),
    new Vector3(1.8, 1.8, 1.8),
    false,
    undefined,
    2.7,
    undefined,
    2.7
  );
  await loadAssetWithCollider(
    "palmTree3",
    "PIRATE_KIT_MODELS",
    "PALM_TREE_3_GLB",
    scene,
    new Vector3(-5, 0, 15),
    new Vector3(2.2, 2.2, 2.2),
    false,
    undefined,
    3.3,
    undefined,
    3.3
  );
  await loadAssetWithCollider(
    "chestClosed",
    "PIRATE_KIT_MODELS",
    "CHEST_CLOSED_GLB",
    scene,
    new Vector3(18, 0, 18),
    new Vector3(1, 1, 1),
    false,
    (collider) => {
      new ClosedChest(collider as Mesh, true, "key_old_chest", () => {
        if (collider.metadata && collider.metadata.chestInstance) {
          const ray = camera.getForwardRay(
            PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE
          );
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
  await initializeGameAssets();
}

setupGameAndPhysics().catch((error) => {
  console.error("Error during game and physics setup:", error);
});
