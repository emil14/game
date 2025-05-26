export const UI_ELEMENT_IDS = {
  RENDER_CANVAS: "renderCanvas",
  FPS_DISPLAY: "fpsDisplay",
  STAMINA_TEXT: "staminaText",
  STAMINA_BAR_FILL: "staminaBarFill",
  HEALTH_TEXT: "healthText",
  HEALTH_BAR_FILL: "healthBarFill",
  BLOOD_SCREEN_EFFECT: "bloodScreenEffect",
  ENEMY_INFO_CONTAINER: "enemyInfoContainer",
  ENEMY_HEALTH_TEXT: "enemyHealthText",
  ENEMY_HEALTH_BAR_FILL: "enemyHealthBarFill",
  ENEMY_NAME_TEXT: "enemyNameText",
  ENEMY_LEVEL_TEXT: "enemyLevelText",
  CROSSHAIR: "crosshair",
  FIGHT_MUSIC: "fightMusic",
  DEATH_SCREEN: "deathScreen",
  TAB_MENU: "tab-menu",
  TAB_NAVIGATION: "tab-navigation",
  PLAYER_LEVEL_TAB: "player-level",
  PLAYER_HEALTH_TAB: "player-health",
  PLAYER_STAMINA_TAB: "player-stamina",
  PLAYER_EXPERIENCE_TAB: "player-experience",
  EXPERIENCE_BAR_FILL_TAB: "experience-bar-fill-tab",
  INGAME_TIME_TAB: "ingame-time-tab",
  UI_CONTAINER: "mainHudContainer",
};

export const PLAYER_CONFIG = {
  CROSSHAIR_MAX_DISTANCE: 30,
  DEFAULT_SPEED: 2.0,
  RUN_SPEED_MULTIPLIER: 2.0,
  CROUCH_SPEED_MULTIPLIER: 0.5,
  JUMP_FORCE: 5,
  JUMP_STAMINA_COST: 15,
  MAX_STAMINA: 100,
  STAMINA_DEPLETION_RATE: 10, // per second
  STAMINA_REGENERATION_RATE: 5, // per second
  MAX_HEALTH: 100,
  PLAYER_HEIGHT: 1.8,
  PLAYER_RADIUS: 0.4,
  PLAYER_MASS: 70,
  PLAYER_FRICTION: 0.7,
  PLAYER_RESTITUTION: 0.1,
  PLAYER_EYE_HEIGHT_OFFSET: 0.6, // From the center of the capsule
  SWORD_DAMAGE: 25, // Default sword damage
  SWORD_ATTACK_DISTANCE: 2.0, // Sword attack range (meters)
};

export const CAMERA_CONFIG = {
  ANGULAR_SENSIBILITY: 2000,
  INERTIA: 0,
  CROUCH_CAMERA_Y: 1.0,
  STAND_CAMERA_Y: 1.6,
  PLAYER_LIGHT_INTENSITY: 0.3,
  PLAYER_LIGHT_RANGE: 10,
  MAX_Z: 10000,
  BASE_FOV: 0.8, // Default FOV in radians (BabylonJS default)
  MAX_FOV: 0.9, // Max FOV in radians when running at max speed
};

export const WORLD_CONFIG = {
  CYCLE_DURATION_SECONDS: 1440, // 24 minutes
  INITIAL_CYCLE_TIME_PROGRESS: 0.5, // Midday
  NEW_SUNRISE_HOUR: 5,
  NEW_SUNSET_HOUR: 20,
  DAY_NIGHT_TRANSITION_WIDTH_HOURS_PORTION: 0.05, // Proportion of 24h for half-width of transition
  SUN_ANGLE_NIGHT: -0.2,
  SUN_ANGLE_HORIZON: 0.0,
  SUN_ANGLE_PEAK: 0.5,
  SKYBOX_TURBIDITY: 10,
  SKYBOX_MIE_DIRECTIONAL_G: 0.8,
  SKYBOX_AZIMUTH: 0.25, // Sun's starting horizontal angle
  SKYBOX_LUMINANCE: 1.0, // For day skybox material
  MOON_DISTANCE_FROM_CAMERA: 400,
  GROUND_SIZE: 50,
  WALL_HEIGHT: 100,
  WALL_THICKNESS: 0.1,
};

export const ASSET_PATHS = {
  BASE: "assets/",
  TEXTURES: "assets/textures/",
  MODELS: "assets/models/",
  SKYBOX_NIGHT: "assets/skybox/night/bkg1", // Base path for night skybox, _left.webp etc. are appended
  SOUNDS: "assets/sounds/", // Example if you add sounds
  MUSIC: "assets/music/",
  SAND_TEXTURE: "assets/textures/sand.png",
  MOON_TEXTURE: "assets/skybox/moon.png",
  PIRATE_KIT_MODELS: "assets/models/pirate_kit/",
  ENEMY_MODELS: "assets/models/enemies/",
  PALM_TREE_1_GLB: "palm_tree1.glb",
  PALM_TREE_2_GLB: "palm_tree2.glb",
  PALM_TREE_3_GLB: "palm_tree3.glb",
  CHEST_CLOSED_GLB: "chest_closed.glb",
  SPIDER_GLB: "spider.glb",
  SWORD_GLB: "sword.glb",
  FIGHT_MUSIC_FILE: "musorgsky_night_on_bald_mountain.mp3",
};

export const PHYSICS_CONFIG = {
  GRAVITY_Y: -9.81,
  GROUND_CHECK_DISTANCE: 0.2,
  GROUND_FRICTION: 0.5,
  GROUND_RESTITUTION: 0.1,
  WALL_FRICTION: 0.5,
  WALL_RESTITUTION: 0.1,
  HAVOK_WASM_PATH: "/node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm",
};

// Key Mappings (using event.key.toLowerCase() or event.code)
export const KEY_MAPPINGS = {
  SPRINT: "shift",
  FORWARD: "w",
  BACKWARD: "s",
  LEFT: "a",
  RIGHT: "d",
  CROUCH: "c",
  JUMP: " ", // Space
  RESPAWN: "r",
  TOGGLE_CONSOLE: "/", // or "~"
  TOGGLE_INSPECTOR: "inspect", // This is a console command, not a direct key
  TOGGLE_DEBUG: "debug", // Console command
  OPEN_TAB_MENU: "tab",
  OPEN_INVENTORY_TAB: "i",
  OPEN_JOURNAL_TAB: "j",
  OPEN_MAP_TAB: "m",
  EXIT_POINTER_LOCK: "escape",
};

export const TAB_MENU_CONFIG = {
  PLAYER_STATS_TAB_ID: "player-stats-tab",
  INVENTORY_TAB_ID: "inventory-tab",
  JOURNAL_TAB_ID: "journal-tab",
  MAP_TAB_ID: "map-tab",
  INITIAL_ACTIVE_TAB: "player-stats-tab",
  // Placeholder data, will be managed by Player/Game state later
  PLACEHOLDER_PLAYER_LEVEL: 1,
  PLACEHOLDER_PLAYER_EXP_TO_NEXT_LEVEL: 1000,
  PLACEHOLDER_PLAYER_CURRENT_EXP: 250,
};

// Game settings
export const GAME_SETTINGS = {
  DEBUG_START_MODE: false,
};
