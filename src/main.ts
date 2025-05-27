import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

import { UI_ELEMENT_IDS, KEY_MAPPINGS, TAB_MENU_CONFIG } from "./config";
import { Game } from "./game";

const canvas = document.getElementById(
  UI_ELEMENT_IDS.RENDER_CANVAS
) as HTMLCanvasElement;

const game = new Game(canvas);

window.addEventListener("resize", () => {
  game.engine.resize();
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
      if (!isTabMenuOpen && !game.engine.isPointerLock)
        game.engine.enterPointerlock();
    });
  }

  function updateStatsTabData() {
    if (
      !tabMenu ||
      tabMenu.classList.contains("hidden") ||
      currentActiveTab !== TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID
    )
      return;
    const currentHealthGame = game.playerManager.getCurrentHealth();
    const maxHealthGame = game.playerManager.getMaxHealth();
    const currentStaminaGame = game.playerManager.getCurrentStamina();
    const maxStaminaGame = game.playerManager.getMaxStamina();
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
      ingameTimeDisplayTab.textContent =
        game.skyManager.getCurrentTimeFormatted();
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
    game.hudManager.hideCoreHud();
    if (game.engine.isPointerLock) game.engine.exitPointerlock();
    setActiveTab(
      tabIdToShow || currentActiveTab || TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB
    );
  }

  function closeTabMenu() {
    isTabMenuOpen = false;
    tabMenu.classList.add("hidden");
    game.hudManager.showCoreHud();
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
      if (game.engine.isPointerLock) game.engine.exitPointerlock();
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
        game.skyManager.setTime(hours, minutes);
      } else {
        console.error(
          "Invalid time format or value for set_time. Use HH:MM (00:00 - 23:59)."
        );
      }
    }
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_INSPECTOR) {
    game.hudManager.toggleInspector();
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_DEBUG) {
    console.log(`Debug mode toggled (handled in Game.update loop).`);
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

await game.start();
