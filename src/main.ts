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
    // Shift key
    isShiftPressed = true;
    if (currentStamina > 0 && !isSprinting) {
      isSprinting = true;
      camera.speed = defaultSpeed * runSpeedMultiplier;
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
  }
});

window.addEventListener("keyup", (event) => {
  const keyCode = event.keyCode;
  if (keyCode === 16) {
    // Shift key
    isShiftPressed = false;
    if (isSprinting) {
      isSprinting = false;
      camera.speed = defaultSpeed;
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

SceneLoader.ImportMeshAsync(
  "",
  "assets/animated_enemies_by_quaternius/",
  "Spider.glb",
  scene
).then((result) => {
  const visualSpider = result.meshes[0] as AbstractMesh;
  visualSpider.name = "spiderVisual";

  const initialVisualSpiderWorldPos = new Vector3(5, 0, 5); // Desired initial world position for the spider entity
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
      }
    }
  }
});

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000; // Delta time in seconds

  // Spider movement and rotation logic
  if (spiderColliderMesh && !playerIsDead) {
    // Spider acts only if player is alive
    const spiderSpeed = defaultSpeed; // Slightly faster than player's default walk speed
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
    }

    // Make the spider look at the player if aggroed
    if (distanceToPlayer < aggroRadius) {
      const lookAtTargetPosition = new Vector3(
        camera.globalPosition.x,
        spiderColliderMesh.position.y,
        camera.globalPosition.z
      );
      spiderColliderMesh.lookAt(lookAtTargetPosition, Math.PI);
    }

    // Animation control & Attack Logic
    if (distanceToPlayer <= stoppingDistance) {
      // Attacking state
      if (spiderWalkAnimation && spiderWalkAnimation.isPlaying) {
        spiderWalkAnimation.stop();
      }
      if (spiderIdleAnimation && spiderIdleAnimation.isPlaying) {
        spiderIdleAnimation.stop();
      }
      if (spiderAttackAnimation && !spiderAttackAnimation.isPlaying) {
        spiderAttackAnimation.start(
          true,
          1.0,
          spiderAttackAnimation.from,
          spiderAttackAnimation.to,
          false
        );
      }

      // Handle spider attack
      timeSinceLastSpiderAttack += deltaTime;
      if (timeSinceLastSpiderAttack >= spiderAttackCooldown) {
        currentHealth -= spiderAttackDamage;
        timeSinceLastSpiderAttack = 0; // Reset cooldown

        if (bloodScreenEffect) {
          bloodScreenEffect.style.backgroundColor = "rgba(255, 0, 0, 0.3)"; // Red with some transparency
          bloodScreenEffect.style.opacity = "1";
          setTimeout(() => {
            bloodScreenEffect.style.opacity = "0";
          }, 200); // Duration of the flash
        }

        if (currentHealth < 0) {
          currentHealth = 0;
        }
        // console.log(`Player hit by spider! Health: ${currentHealth}`); // Debug log

        if (currentHealth === 0) {
          playerIsDead = true;
          alert("Player is dead");
          // Optional: Stop player input or other game features
          // camera.detachControl(canvas);
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
      timeSinceLastSpiderAttack = 0; // Reset attack cooldown if player moves out of range
    } else {
      // Idle state (implies distanceToPlayer >= aggroRadius, so !isSpiderMoving)
      if (spiderWalkAnimation && spiderWalkAnimation.isPlaying) {
        spiderWalkAnimation.stop();
      }
      if (spiderAttackAnimation && spiderAttackAnimation.isPlaying) {
        spiderAttackAnimation.stop();
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
      timeSinceLastSpiderAttack = 0; // Reset attack cooldown if spider is idle
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
        camera.speed = defaultSpeed;
      }
    } else {
      // If shift is not pressed and not sprinting (e.g. ran out of stamina but still holding shift)
      // ensure speed is normal.
      if (camera.speed !== defaultSpeed && !isShiftPressed) {
        camera.speed = defaultSpeed;
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
    camera.speed = defaultSpeed * runSpeedMultiplier;
  }

  scene.render();
  if (fpsDisplay) {
    fpsDisplay.textContent = "FPS: " + engine.getFps().toFixed();
  }
  if (staminaText && staminaBarFill) {
    staminaText.textContent =
      "👟 " + currentStamina.toFixed(0) + "/" + maxStamina;
    staminaBarFill.style.width = (currentStamina / maxStamina) * 100 + "%";
  }
  if (healthText && healthBarFill) {
    healthText.textContent = "❤️ " + currentHealth.toFixed(0) + "/" + maxHealth;
    healthBarFill.style.width = (currentHealth / maxHealth) * 100 + "%";
  }
});

window.addEventListener("resize", () => {
  engine.resize();
});
