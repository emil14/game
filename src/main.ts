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
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

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

let spiderColliderMesh: Mesh | null = null; // To store the spider's collider
let spiderWalkAnimation: AnimationGroup | null = null; // To store the spider's walk animation
let spiderIdleAnimation: AnimationGroup | null = null; // To store the spider's idle animation
let spiderAttackAnimation: AnimationGroup | null = null; // To store the spider's attack animation
let spiderAttackAnimationDurationSeconds = 0.75; // Default/fallback, will be calculated

const camera = new FreeCamera("camera1", new Vector3(0, 1.6, -5), scene);
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

// Spider attack parameters
const spiderAttackDamage = 10;
const spiderAttackCooldown = 1.5; // Seconds
let timeSinceLastSpiderAttack = 0;

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
// Initial sky material properties (will be updated by day/night cycle)
skyMaterial.turbidity = 10; // Default turbidity
skyMaterial.luminance = 1.0; // Default luminance
skyMaterial.mieDirectionalG = 0.8;
skyMaterial.useSunPosition = true; // Important for linking to DirectionalLight

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

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/enemies/",
  "spider.glb",
  scene
).then((result) => {
  const visualSpider = result.meshes[0] as AbstractMesh;
  visualSpider.name = "spiderVisual";

  const initialVisualSpiderWorldPos = new Vector3(20, 0, 20); // Desired initial world position for the spider entity
  visualSpider.position = initialVisualSpiderWorldPos.clone();
  visualSpider.scaling = new Vector3(0.5, 0.5, 0.5);

  // Disable collisions on the visual mesh and its children
  visualSpider.checkCollisions = false;
  visualSpider
    .getChildMeshes(false, (node): node is Mesh => node instanceof Mesh)
    .forEach((childMesh) => {
      childMesh.checkCollisions = false;
    });

  // Ensure transformations are applied before getting bounding box
  visualSpider.computeWorldMatrix(true);

  // Get the bounding vectors for the entire hierarchy in world space
  const boundingInfo = visualSpider.getHierarchyBoundingVectors(true);
  const spiderDimensions = boundingInfo.max.subtract(boundingInfo.min);

  // Create an invisible collider box and assign to the scene-level variable
  spiderColliderMesh = MeshBuilder.CreateBox(
    "spiderCollider",
    {
      width: spiderDimensions.x > 0 ? spiderDimensions.x : 0.1,
      height: spiderDimensions.y > 0 ? spiderDimensions.y : 0.1,
      depth: spiderDimensions.z > 0 ? spiderDimensions.z : 0.1,
    },
    scene
  );

  // Position the collider box to encapsulate the visual model in world space
  // The center of the bounding box is (min + max) / 2
  spiderColliderMesh.position = boundingInfo.min.add(
    spiderDimensions.scale(0.5)
  );

  spiderColliderMesh.checkCollisions = true;
  spiderColliderMesh.isVisible = false; // Set to true to debug collider position/size

  // Parent the visual spider to the collider box
  visualSpider.parent = spiderColliderMesh;
  visualSpider.position = initialVisualSpiderWorldPos.subtract(
    spiderColliderMesh.position
  );

  // Find and store walk, idle, and attack animations
  if (result.animationGroups && result.animationGroups.length > 0) {
    for (let group of result.animationGroups) {
      if (group.name === "SpiderArmature|Spider_Walk") {
        spiderWalkAnimation = group;
        spiderWalkAnimation.stop();
      } else if (group.name === "SpiderArmature|Spider_Idle") {
        spiderIdleAnimation = group;
        spiderIdleAnimation.stop();
      } else if (group.name === "SpiderArmature|Spider_Attack") {
        // Assuming this is the attack animation name
        spiderAttackAnimation = group;
        spiderAttackAnimation.stop();

        if (spiderAttackAnimation.targetedAnimations.length > 0) {
          // Assuming all tracks in this group share the same frame rate
          // and the group's 'from' and 'to' correctly define the clip's range.
          const firstAnimTrack =
            spiderAttackAnimation.targetedAnimations[0].animation;
          const frameRate = firstAnimTrack.framePerSecond;
          // Use the group's full range for duration calculation as it represents the clip
          const numFrames = group.to - group.from;
          if (frameRate > 0 && numFrames > 0) {
            spiderAttackAnimationDurationSeconds = numFrames / frameRate;
            console.log(
              `Spider attack animation duration: ${spiderAttackAnimationDurationSeconds}s`
            );
          } else {
            console.warn(
              "Spider attack animation has frameRate 0, undefined, or no frames. Using fallback duration."
            );
            // Fallback duration is already set at declaration (e.g., 0.75s)
          }
        } else {
          console.warn(
            "Spider attack animation group has no targeted animations. Using fallback duration."
          );
          // Fallback duration is already set at declaration
        }
      }
    }
  }
});

SceneLoader.ImportMeshAsync(
  "",
  "assets/models/pirate_kit/",
  "palm_tree1.glb",
  scene
).then((result) => {
  const palmTreeVisual = result.meshes[0] as AbstractMesh;
  palmTreeVisual.name = "palmTreeVisual";

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
    "palmTreeCollider",
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
    skyMaterial.luminance = 0.005; // Very dark
    skyMaterial.turbidity = 20; // Higher turbidity can make night sky darker, less star definition
    skyMaterial.rayleigh = 0.5; // Lower rayleigh for less blue scattering, allowing dark blue
    light.intensity = 0.05; // Very dim ambient
    sunLight.intensity = 0; // Sun off
  } else if (cycleProgress < 0.25 + dayNightTransition) {
    // Sunrise transition
    const sunriseProgress =
      (cycleProgress - (0.25 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = -0.2 + sunriseProgress * 0.2; // from -0.2 to 0
    skyMaterial.luminance = Color3.Lerp(
      new Color3(0.005, 0, 0),
      new Color3(1.0, 0, 0),
      sunriseProgress
    ).r; // LERP luminance
    skyMaterial.turbidity = 20 - sunriseProgress * 15; // Turbidity from 20 down to 5
    skyMaterial.rayleigh = 0.5 + sunriseProgress * 1.5; // Rayleigh from 0.5 up to 2.0
    light.intensity = 0.05 + sunriseProgress * 0.65;
    sunLight.intensity = sunriseProgress * 1.0;
  } else if (cycleProgress < 0.5 - dayNightTransition) {
    // Daytime
    const dayProgress =
      (cycleProgress - (0.25 + dayNightTransition)) /
      (0.5 - dayNightTransition - (0.25 + dayNightTransition));
    currentInclination = dayProgress * 0.5; // 0 to 0.5
    skyMaterial.luminance = 1.0;
    skyMaterial.turbidity = 5;
    skyMaterial.rayleigh = 2.0;
    light.intensity = 0.7;
    sunLight.intensity = 1.0;
  } else if (cycleProgress < 0.5 + dayNightTransition) {
    // Midday peak (smooth transition for inclination)
    const middayProgress =
      (cycleProgress - (0.5 - dayNightTransition)) / (dayNightTransition * 2);
    currentInclination = 0.5 - middayProgress * 0.0; // Stays around 0.5
    skyMaterial.luminance = 1.0;
    skyMaterial.turbidity = 5;
    skyMaterial.rayleigh = 2.0;
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
    skyMaterial.luminance = 1.0; // Still full day brightness
    skyMaterial.turbidity = 5;
    skyMaterial.rayleigh = 2.0;
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
    skyMaterial.luminance = Color3.Lerp(
      new Color3(1.0, 0, 0), // Start with full luminance (adjusted for sunset color if desired)
      new Color3(0.005, 0, 0),
      duskProgress
    ).r;
    skyMaterial.turbidity = 5 + duskProgress * 15; // Turbidity from 5 up to 20
    skyMaterial.rayleigh = 2.0 - duskProgress * 1.5; // Rayleigh from 2.0 down to 0.5
    light.intensity = 0.7 - duskProgress * 0.65; // Ambient light from 0.7 down to 0.05
    sunLight.intensity = 1.0 - duskProgress * 1.0; // Sun light from 1.0 down to 0.0
  } else {
    // Night
    currentInclination = -0.2; // Sun further below horizon
    skyMaterial.luminance = 0.005; // Very dark
    skyMaterial.turbidity = 20;
    skyMaterial.rayleigh = 0.5;
    light.intensity = 0.05; // Very dim ambient
    sunLight.intensity = 0; // Sun off
  }

  skyMaterial.inclination = currentInclination;
  skyMaterial.azimuth = 0.25; // Fixed azimuth for now, could also be animated

  // Update sun position for SkyMaterial (Babylon uses a convention where Y is up)
  // A common way to get sun position from inclination (angle from horizon) and azimuth (rotation around Y)
  // inclination = 0 is horizon, 0.5 * PI is zenith. SkyMaterial inclination is 0 to 0.5.
  const phi = skyMaterial.inclination * Math.PI; // Convert to radians for spherical coords, 0 to PI/2
  const theta = skyMaterial.azimuth * 2 * Math.PI; // Convert to radians, 0 to 2PI

  skyMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
  skyMaterial.sunPosition.y = Math.sin(phi);
  skyMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);

  // Update DirectionalLight direction
  // DirectionalLight direction is where the light is pointing TO.
  // If sunPosition is (0,1,0) (zenith), light direction should be (0,-1,0) (straight down).
  sunLight.direction = skyMaterial.sunPosition.scale(-1);

  let isAnyEnemyAggro = false; // Reset per frame

  // Spider movement and rotation logic
  if (spiderColliderMesh && !playerIsDead) {
    // Spider acts only if player is alive
    const spiderSpeed = defaultSpeed; // Spider's speed is equal to player's default walk speed
    const aggroRadius = 20.0; // Spider starts following if player is within this distance
    const stoppingDistance = 2.5; // Spider stops this close to the player (collider center to camera center)

    // Calculate direction on X-Z plane only for movement
    const directionToPlayerXZ = camera.globalPosition.subtract(
      spiderColliderMesh.position
    );
    directionToPlayerXZ.y = 0; // Keep movement horizontal
    const distanceToPlayer = directionToPlayerXZ.length();

    let isSpiderMoving = false;
    if (distanceToPlayer < aggroRadius && distanceToPlayer > stoppingDistance) {
      directionToPlayerXZ.normalize();
      spiderColliderMesh.position.addInPlace(
        directionToPlayerXZ.scale(spiderSpeed * deltaTime)
      );
      isSpiderMoving = true;
      isAnyEnemyAggro = true; // Spider is aggro if following
    }

    // Make the spider look at the player if aggroed
    if (distanceToPlayer < aggroRadius) {
      const lookAtTargetPosition = new Vector3(
        camera.globalPosition.x,
        spiderColliderMesh.position.y,
        camera.globalPosition.z
      );
      spiderColliderMesh.lookAt(lookAtTargetPosition, Math.PI);
      isAnyEnemyAggro = true; // Spider is aggro if looking/close enough to attack
    }

    // Always increment the cooldown timer for the next potential attack
    timeSinceLastSpiderAttack += deltaTime;

    // Animation control & Attack Logic
    if (distanceToPlayer <= stoppingDistance) {
      // Player is in attack range
      isAnyEnemyAggro = true; // Ensure aggro status

      if (timeSinceLastSpiderAttack >= spiderAttackCooldown) {
        // Cooldown is over, ready to attack
        if (spiderWalkAnimation && spiderWalkAnimation.isPlaying) {
          spiderWalkAnimation.stop();
        }
        if (spiderIdleAnimation && spiderIdleAnimation.isPlaying) {
          spiderIdleAnimation.stop();
        }

        if (spiderAttackAnimation && !spiderAttackAnimation.isPlaying) {
          spiderAttackAnimation.start(
            false, // Play ONCE
            1.0,
            spiderAttackAnimation.from,
            spiderAttackAnimation.to,
            false
          );
          timeSinceLastSpiderAttack = 0; // Reset cooldown AFTER initiating the attack animation

          // Schedule damage to occur part-way through the animation
          const damageDelayFactor = 0.6; // Apply damage 60% of the way through animation (can be tweaked)
          const damageDelayMilliseconds =
            spiderAttackAnimationDurationSeconds * damageDelayFactor * 1000;

          setTimeout(() => {
            if (playerIsDead || !spiderColliderMesh || !camera) return; // Safety checks

            // Check distance again at the moment of intended impact
            const finalDistanceToPlayer = camera.globalPosition
              .subtract(spiderColliderMesh.position)
              .length();
            // Allow a small tolerance for player movement during animation wind-up
            if (finalDistanceToPlayer <= stoppingDistance + 0.75) {
              currentHealth -= spiderAttackDamage;

              if (bloodScreenEffect) {
                bloodScreenEffect.style.backgroundColor =
                  "rgba(255, 0, 0, 0.3)";
                bloodScreenEffect.style.opacity = "1";
                setTimeout(() => {
                  bloodScreenEffect.style.opacity = "0";
                }, 200); // Duration of the flash
              }

              if (currentHealth < 0) {
                currentHealth = 0;
              }
              // console.log(`Player hit by spider via setTimeout! Health: ${currentHealth}`);

              if (currentHealth === 0 && !playerIsDead) {
                playerIsDead = true;
                // camera.detachControl(canvas); // Keep camera control for now
                alert("You are dead! The page will now reload.");
                window.location.reload();
              }
            }
          }, damageDelayMilliseconds);
        }
      } else {
        // Attack is on cooldown, but player is still in range. Play idle.
        // Let current attack animation play out if it is, then switch to idle.
        if (spiderAttackAnimation && spiderAttackAnimation.isPlaying) {
          // Animation is playing, do nothing, let it finish its visual course
        } else {
          if (spiderWalkAnimation && spiderWalkAnimation.isPlaying) {
            spiderWalkAnimation.stop();
          }
          if (spiderIdleAnimation && !spiderIdleAnimation.isPlaying) {
            spiderIdleAnimation.start(
              true,
              1.0,
              spiderIdleAnimation.from,
              spiderIdleAnimation.to,
              false
            );
          }
        }
      }
    } else if (isSpiderMoving) {
      // Following state (implies distanceToPlayer > stoppingDistance && distanceToPlayer < aggroRadius)
      if (spiderAttackAnimation && spiderAttackAnimation.isPlaying) {
        spiderAttackAnimation.stop();
      }
      if (spiderIdleAnimation && spiderIdleAnimation.isPlaying) {
        spiderIdleAnimation.stop();
      }
      if (spiderWalkAnimation && !spiderWalkAnimation.isPlaying) {
        spiderWalkAnimation.start(
          true,
          1.0,
          spiderWalkAnimation.from,
          spiderWalkAnimation.to,
          false
        );
      }
      // timeSinceLastSpiderAttack continues to increment. No reset here.
    } else {
      // Idle state (implies distanceToPlayer >= aggroRadius, or not moving for other reasons)
      if (spiderWalkAnimation && spiderWalkAnimation.isPlaying) {
        spiderWalkAnimation.stop();
      }
      if (spiderAttackAnimation && spiderAttackAnimation.isPlaying) {
        // If player moved out of range while attack animation was playing (e.g. very long anim)
        spiderAttackAnimation.stop(); // This will prevent onAnimationEndObservable from firing for damage
      }
      if (spiderIdleAnimation && !spiderIdleAnimation.isPlaying) {
        spiderIdleAnimation.start(
          true,
          1.0,
          spiderIdleAnimation.from,
          spiderIdleAnimation.to,
          false
        );
      }
      // timeSinceLastSpiderAttack continues to increment. No reset here.
    }
  } else if (spiderColliderMesh && playerIsDead) {
    // Spider behavior after player death (e.g., return to idle)
    const isAttacking =
      spiderAttackAnimation && spiderAttackAnimation.isPlaying;
    const isWalking = spiderWalkAnimation && spiderWalkAnimation.isPlaying;

    if (isAttacking && spiderAttackAnimation) spiderAttackAnimation.stop();
    if (isWalking && spiderWalkAnimation) spiderWalkAnimation.stop();

    if (!isAttacking && !isWalking) {
      if (spiderIdleAnimation && !spiderIdleAnimation.isPlaying) {
        spiderIdleAnimation.start(
          true,
          1.0,
          spiderIdleAnimation.from,
          spiderIdleAnimation.to,
          false
        );
      }
    }
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

  // Stamina logic
  if (!playerIsDead) {
    // Only process stamina if player is alive
    if (isSprinting) {
      if (currentStamina > 0) {
        currentStamina -= staminaDepletionRate * deltaTime;
        if (currentStamina < 0) {
          currentStamina = 0;
        }
      }
      if (currentStamina === 0) {
        isSprinting = false;
        if (isCrouching) {
          camera.speed = defaultSpeed * crouchSpeedMultiplier;
        } else {
          camera.speed = defaultSpeed;
        }
      }
    } else {
      // If shift is not pressed and not sprinting (e.g. ran out of stamina but still holding shift)
      // ensure speed is normal/crouch speed.
      if (isCrouching) {
        if (
          camera.speed !== defaultSpeed * crouchSpeedMultiplier &&
          !isShiftPressed
        ) {
          camera.speed = defaultSpeed * crouchSpeedMultiplier;
        }
      } else {
        if (camera.speed !== defaultSpeed && !isShiftPressed) {
          camera.speed = defaultSpeed;
        }
      }

      if (currentStamina < maxStamina) {
        let currentRegenRate = staminaRegenerationRate;
        const isMoving =
          isMovingForward || isMovingBackward || isMovingLeft || isMovingRight;
        if (isMoving) {
          currentRegenRate = 0;
        }

        if (currentRegenRate > 0) {
          currentStamina += currentRegenRate * deltaTime;
          if (currentStamina > maxStamina) {
            currentStamina = maxStamina;
          }
        }
      }
    }
  }

  // Keep sprinting if shift is held and stamina is available
  if (!playerIsDead && isShiftPressed && !isSprinting && currentStamina > 0) {
    isSprinting = true;
    if (isCrouching) {
      camera.speed = defaultSpeed; // Sprinting while crouching
    } else {
      camera.speed = defaultSpeed * runSpeedMultiplier;
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
    const pickInfo = scene.pickWithRay(
      ray,
      (mesh) => mesh === spiderColliderMesh
    );

    if (
      pickInfo &&
      pickInfo.hit &&
      pickInfo.pickedMesh === spiderColliderMesh
    ) {
      enemyInfoContainer.style.display = "block";
      crosshairElement.classList.add("crosshair-enemy-focus");
      if (crosshairElement) crosshairElement.textContent = "💢"; // Fight mode crosshair

      // Update new combined title line
      enemyNameText.textContent = "Spider"; // Placeholder name
      enemyLevelText.textContent = "| Lvl 1"; // Placeholder level

      // Placeholder health as requested
      const placeholderMaxHealth = 100;
      const placeholderCurrentHealth = 100;
      enemyHealthText.textContent = `${placeholderCurrentHealth}/${placeholderMaxHealth}`;
      enemyHealthBarFill.style.width = `${
        (placeholderCurrentHealth / placeholderMaxHealth) * 100
      }%`;
    } else {
      enemyInfoContainer.style.display = "none";
      crosshairElement.classList.remove("crosshair-enemy-focus");
      if (crosshairElement) crosshairElement.textContent = "•"; // Normal crosshair (bullet)
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
