import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";

import { HavokPlugin } from "@babylonjs/core/Physics";
import HavokPhysics from "@babylonjs/havok";
import {
  PhysicsAggregate,
  PhysicsShapeType,
} from "@babylonjs/core/Physics";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

import {
  UI_ELEMENT_IDS,
  PLAYER_CONFIG,
  WORLD_CONFIG,
  ASSET_PATHS,
  PHYSICS_CONFIG,
  KEY_MAPPINGS,
  GAME_SETTINGS,
  TAB_MENU_CONFIG,
} from "./config";
import { InputManager } from "./input_manager";
import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { PlayerManager } from "./player_manager";
import { Spider } from "./enemies/spider";
import { ClosedChest } from "./interactables";
import { Game } from "./game";

const canvas = document.getElementById(
  UI_ELEMENT_IDS.RENDER_CANVAS
) as HTMLCanvasElement;

const game = new Game(canvas);
const engine = game.engine;
const scene = game.scene;

const inputManager = new InputManager(canvas);

const hudManager = new HUDManager(engine, scene);
const skyManager = new SkyManager(scene);
const playerManager = new PlayerManager(
  scene,
  inputManager,
  hudManager,
  canvas
);

const fightMusic = document.getElementById(
  UI_ELEMENT_IDS.FIGHT_MUSIC
) as HTMLAudioElement | null;

let havokInstance: any;
let spiders: Spider[] = [];

let isDebugModeEnabled = GAME_SETTINGS.DEBUG_START_MODE;
let debugRayHelper: RayHelper | null = null;

const crosshairMaxDistance = PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE;

let isInFightMode = false;

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
(groundMaterial.diffuseTexture as Texture).uScale = 8;
(groundMaterial.diffuseTexture as Texture).vScale = 8;
ground.material = groundMaterial;

const wallHeight = WORLD_CONFIG.WALL_HEIGHT;
const wallThickness = WORLD_CONFIG.WALL_THICKNESS;
const groundSize = WORLD_CONFIG.GROUND_SIZE;
const wallPositions: [number, number, number, number][] = [
  [0, groundSize / 2, groundSize, wallThickness],
  [0, -groundSize / 2, groundSize, wallThickness],
  [-groundSize / 2, 0, wallThickness, groundSize],
  [groundSize / 2, 0, wallThickness, groundSize],
];

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

    collider.isVisible = GAME_SETTINGS.DEBUG_START_MODE;

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
      if (playerManager.playerIsDead) return;
      playerManager.takeDamage(damage);
    });
  } catch (error) {
    console.error("Failed to create spider:", error);
  }

  await playerManager.initializeSword();
}

engine.runRenderLoop(() => {
  const deltaTime = engine.getDeltaTime() / 1000;

  playerManager.update(deltaTime);

  skyManager.update(deltaTime);

  let isAnyEnemyAggro = false;
  if (!playerManager.playerIsDead) {
    spiders.forEach((spider) => {
      if (spider.currentHealth > 0) {
        spider.update(deltaTime, playerManager.camera);
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

  // Update HUD with player stats
  hudManager.updatePlayerStats(
    playerManager.getCurrentHealth(),
    playerManager.getMaxHealth(),
    playerManager.getCurrentStamina(),
    playerManager.getMaxStamina()
  );

  // Handle player death
  if (
    playerManager.playerIsDead &&
    isInFightMode &&
    fightMusic &&
    !fightMusic.paused
  ) {
    fightMusic.pause();
    fightMusic.currentTime = 0;
    isInFightMode = false;
  }

  // Crosshair targeting system
  playerManager.camera.computeWorldMatrix();
  const rayOrigin = playerManager.camera.globalPosition;
  const forwardDirection = playerManager.camera.getDirection(Vector3.Forward());
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
        hudManager.setCrosshairText("✋");
        hudManager.setCrosshairFocus(false);
        hudManager.hideEnemyInfo();
        crosshairSetForSpecificTarget = true;
      } else if (spiderInstance) {
        hudManager.showEnemyInfo(
          spiderInstance.name,
          spiderInstance.level,
          spiderInstance.currentHealth,
          spiderInstance.maxHealth
        );
        hudManager.setCrosshairText("💢");
        hudManager.setCrosshairFocus(true);
        crosshairSetForSpecificTarget = true;
      }
    } else if (
      pickedMesh.metadata &&
      pickedMesh.metadata.interactableType === "chest"
    ) {
      const chestInstance = pickedMesh.metadata.chestInstance as ClosedChest;
      hudManager.setCrosshairText(chestInstance.getDisplayIcon());
      hudManager.setCrosshairFocus(false);
      hudManager.hideEnemyInfo();
      crosshairSetForSpecificTarget = true;
    }
  }
  if (!crosshairSetForSpecificTarget) {
    hudManager.hideEnemyInfo();
    hudManager.setCrosshairFocus(false);
    hudManager.setCrosshairText("•");
  }

  scene.render();
  hudManager.updateFPS();
});

window.addEventListener("resize", () => {
  engine.resize();
});

document.addEventListener("DOMContentLoaded", () => {
  const tabMenu = document.getElementById(
    UI_ELEMENT_IDS.TAB_MENU
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
    const currentHealthGame = playerManager.getCurrentHealth();
    const maxHealthGame = playerManager.getMaxHealth();
    const currentStaminaGame = playerManager.getCurrentStamina();
    const maxStaminaGame = playerManager.getMaxStamina();
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
      ingameTimeDisplayTab.textContent = skyManager.getCurrentTimeFormatted();
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
    hudManager.hideCoreHud();
    if (engine.isPointerLock) engine.exitPointerlock();
    setActiveTab(
      tabIdToShow || currentActiveTab || TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB
    );
  }

  function closeTabMenu() {
    isTabMenuOpen = false;
    tabMenu.classList.add("hidden");
    hudManager.showCoreHud();
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
        skyManager.setTime(hours, minutes);
      } else {
        console.error(
          "Invalid time format or value for set_time. Use HH:MM (00:00 - 23:59)."
        );
      }
    }
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_INSPECTOR) {
    hudManager.toggleInspector();
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_DEBUG) {
    isDebugModeEnabled = !isDebugModeEnabled;
    console.log(`Debug mode ${isDebugModeEnabled ? "enabled" : "disabled"}.`);
    if (playerManager.playerBodyMesh)
      playerManager.playerBodyMesh.isVisible = isDebugModeEnabled;
    for (let i = 1; i <= 4; i++) {
      const wall = scene.getMeshByName(`wall${i}`);
      if (wall) wall.isVisible = isDebugModeEnabled;
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
        mesh !== playerManager.playerBodyMesh &&
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
    if (input) handleConsoleCommand(input);
  }
});

hudManager.hideDeathScreen();

async function setupGameAndPhysics() {
  console.log("Attempting to initialize Havok Physics...");
  try {
    havokInstance = await HavokPhysics({
      locateFile: (file: string) =>
        file.endsWith(".wasm") ? PHYSICS_CONFIG.HAVOK_WASM_PATH : file,
    });
  } catch (e) {
    console.error(
      "Havok physics engine failed to load or an error occurred during init:",
      e
    );
    return;
  }
  if (!havokInstance) {
    console.error("Havok physics engine could not be initialized.");
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

  wallPositions.forEach(
    (props: [number, number, number, number], i: number) => {
      const wall = MeshBuilder.CreateBox(
        `wall${i + 1}`,
        { width: props[2], height: wallHeight, depth: props[3] },
        scene
      );
      wall.position = new Vector3(props[0], wallHeight / 2, props[1]);
      wall.isVisible = GAME_SETTINGS.DEBUG_START_MODE;
      new PhysicsAggregate(
        wall,
        PhysicsShapeType.BOX,
        {
          mass: 0,
          friction: PHYSICS_CONFIG.WALL_FRICTION,
          restitution: PHYSICS_CONFIG.WALL_RESTITUTION,
        },
        scene
      );
    }
  );

  const playerStartPos = new Vector3(0, 1.0, -5);

  const playerBodyMeshInstance = MeshBuilder.CreateCapsule(
    "playerBody",
    {
      radius: PLAYER_CONFIG.PLAYER_RADIUS,
      height: PLAYER_CONFIG.PLAYER_HEIGHT,
      tessellation: 20,
    },
    scene
  );
  playerBodyMeshInstance.position = playerStartPos.clone();
  playerBodyMeshInstance.position.y =
    playerStartPos.y + PLAYER_CONFIG.PLAYER_HEIGHT / 2;
  playerBodyMeshInstance.isVisible = GAME_SETTINGS.DEBUG_START_MODE;

  // Create physics aggregate for player
  const playerBodyAggregate = new PhysicsAggregate(
    playerBodyMeshInstance,
    PhysicsShapeType.CAPSULE,
    {
      mass: PLAYER_CONFIG.PLAYER_MASS,
      friction: PLAYER_CONFIG.PLAYER_FRICTION,
      restitution: PLAYER_CONFIG.PLAYER_RESTITUTION,
      pointA: new Vector3(
        0,
        -(PLAYER_CONFIG.PLAYER_HEIGHT / 2 - PLAYER_CONFIG.PLAYER_RADIUS),
        0
      ),
      pointB: new Vector3(
        0,
        PLAYER_CONFIG.PLAYER_HEIGHT / 2 - PLAYER_CONFIG.PLAYER_RADIUS,
        0
      ),
      radius: PLAYER_CONFIG.PLAYER_RADIUS,
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

  playerManager.initializePhysics(playerBodyMeshInstance, playerBodyAggregate);

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
          const ray = playerManager.camera.getForwardRay(
            PLAYER_CONFIG.CROSSHAIR_MAX_DISTANCE
          );
          const pickInfo = scene.pickWithRay(ray, (mesh) => mesh === collider);
          if (pickInfo && pickInfo.hit) {
            hudManager.setCrosshairText(
              (collider.metadata.chestInstance as ClosedChest).getDisplayIcon()
            );
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
