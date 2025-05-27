import { Engine } from "@babylonjs/core/Engines/engine";

import { UI_ELEMENT_IDS, KEY_MAPPINGS, TAB_MENU_CONFIG } from "./config";
import { HUDManager } from "./hud_manager";
import { PlayerManager } from "./player_manager";
import { SkyManager } from "./sky_manager";

export class TabMenuManager {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private playerManager: PlayerManager;
  private hudManager: HUDManager;
  private skyManager: SkyManager;

  private tabMenu: HTMLElement;
  private tabNavigation: HTMLElement;
  private tabButtons: HTMLButtonElement[];
  private tabPanes: NodeListOf<HTMLElement>;
  private playerLevelDisplay: HTMLElement;
  private playerHealthDisplay: HTMLElement;
  private playerStaminaDisplay: HTMLElement;
  private playerExperienceDisplay: HTMLElement;
  private experienceBarFillTab: HTMLElement;
  private ingameTimeDisplayTab: HTMLElement;

  private isTabMenuOpen: boolean = false;
  private currentActiveTab: string = TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB;
  private tabPlayerData = {
    level: TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_LEVEL,
    experience: TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_EXP_TO_NEXT_LEVEL,
  };

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    playerManager: PlayerManager,
    hudManager: HUDManager,
    skyManager: SkyManager
  ) {
    this.engine = engine;
    this.canvas = canvas;
    this.playerManager = playerManager;
    this.hudManager = hudManager;
    this.skyManager = skyManager;

    this.tabMenu = document.getElementById(UI_ELEMENT_IDS.TAB_MENU)!;
    this.tabNavigation = document.getElementById(
      UI_ELEMENT_IDS.TAB_NAVIGATION
    )!;
    this.tabButtons = Array.from(
      this.tabNavigation.querySelectorAll(".tab-button")
    ) as HTMLButtonElement[];
    this.tabPanes = document.querySelectorAll(
      "#tab-menu-content .tab-pane"
    ) as NodeListOf<HTMLElement>;
    this.playerLevelDisplay = document.getElementById(
      UI_ELEMENT_IDS.PLAYER_LEVEL_TAB
    )!;
    this.playerHealthDisplay = document.getElementById(
      UI_ELEMENT_IDS.PLAYER_HEALTH_TAB
    )!;
    this.playerStaminaDisplay = document.getElementById(
      UI_ELEMENT_IDS.PLAYER_STAMINA_TAB
    )!;
    this.playerExperienceDisplay = document.getElementById(
      UI_ELEMENT_IDS.PLAYER_EXPERIENCE_TAB
    )!;
    this.experienceBarFillTab = document.getElementById(
      UI_ELEMENT_IDS.EXPERIENCE_BAR_FILL_TAB
    )!;
    this.ingameTimeDisplayTab = document.getElementById(
      UI_ELEMENT_IDS.INGAME_TIME_TAB
    )!;

    this.setupEventListeners();
    this.hideTabMenu();
    this.setActiveTab(this.currentActiveTab);
  }

  private setupEventListeners(): void {
    // Tab button clicks
    this.tabButtons.forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.tab) {
          this.setActiveTab(button.dataset.tab);
        }
      })
    );

    // Keyboard shortcuts
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === KEY_MAPPINGS.OPEN_TAB_MENU) {
        this.toggleTabMenu();
      }
      if (key === KEY_MAPPINGS.EXIT_POINTER_LOCK) {
        if (this.engine.isPointerLock) {
          this.engine.exitPointerlock();
        }
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        switch (key) {
          case KEY_MAPPINGS.OPEN_INVENTORY_TAB:
            event.preventDefault();
            this.toggleTabMenu(TAB_MENU_CONFIG.INVENTORY_TAB_ID);
            break;
          case KEY_MAPPINGS.OPEN_JOURNAL_TAB:
            event.preventDefault();
            this.toggleTabMenu(TAB_MENU_CONFIG.JOURNAL_TAB_ID);
            break;
          case KEY_MAPPINGS.OPEN_MAP_TAB:
            event.preventDefault();
            this.toggleTabMenu(TAB_MENU_CONFIG.MAP_TAB_ID);
            break;
        }
      }
    });

    // Canvas click to re-enter pointer lock
    this.canvas.addEventListener("click", () => {
      if (!this.isTabMenuOpen && !this.engine.isPointerLock) {
        this.engine.enterPointerlock();
      }
    });
  }

  private updateStatsTabData(): void {
    if (
      this.tabMenu.classList.contains("hidden") ||
      this.currentActiveTab !== TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID
    ) {
      return;
    }

    const currentHealthGame = this.playerManager.getCurrentHealth();
    const maxHealthGame = this.playerManager.getMaxHealth();
    const currentStaminaGame = this.playerManager.getCurrentStamina();
    const maxStaminaGame = this.playerManager.getMaxStamina();
    const placeholderCurrentExp =
      TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_CURRENT_EXP;

    this.playerLevelDisplay.textContent = this.tabPlayerData.level.toString();
    this.playerHealthDisplay.textContent = `${currentHealthGame.toFixed(
      0
    )} / ${maxHealthGame.toFixed(0)}`;
    this.playerStaminaDisplay.textContent = `${currentStaminaGame.toFixed(
      0
    )} / ${maxStaminaGame.toFixed(0)}`;
    this.playerExperienceDisplay.textContent = `${placeholderCurrentExp} / ${this.tabPlayerData.experience}`;
    this.ingameTimeDisplayTab.textContent =
      this.skyManager.getCurrentTimeFormatted();
    this.experienceBarFillTab.style.width = `${
      (placeholderCurrentExp / this.tabPlayerData.experience) * 100
    }%`;
  }

  private setActiveTab(tabId: string): void {
    this.currentActiveTab = tabId;
    this.tabButtons.forEach((button) =>
      button.classList.toggle("active", button.dataset.tab === tabId)
    );
    this.tabPanes.forEach((pane) =>
      pane.classList.toggle("active", pane.id === tabId)
    );
    if (tabId === TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID) {
      this.updateStatsTabData();
    }
  }

  private showTabMenu(tabIdToShow?: string): void {
    this.isTabMenuOpen = true;
    this.tabMenu.classList.remove("hidden");
    this.hudManager.hideCoreHud();
    if (this.engine.isPointerLock) {
      this.engine.exitPointerlock();
    }
    this.setActiveTab(
      tabIdToShow || this.currentActiveTab || TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB
    );
  }

  private hideTabMenu(): void {
    this.isTabMenuOpen = false;
    this.tabMenu.classList.add("hidden");
    this.hudManager.showCoreHud();
  }

  private toggleTabMenu(tabIdToShow?: string): void {
    if (
      this.isTabMenuOpen &&
      (!tabIdToShow || tabIdToShow === this.currentActiveTab)
    ) {
      this.hideTabMenu();
    } else {
      this.showTabMenu(tabIdToShow);
    }
  }
}
