import { UI_ELEMENT_IDS, KEY_MAPPINGS, TAB_MENU_CONFIG } from "../config";
import type { Game } from "../game";

export class TabMenuManager {
  private game: Game;
  private config: typeof import("../config");

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
    experienceToNextLevel: TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_EXP_TO_NEXT_LEVEL,
  };

  constructor(game: Game, config: typeof import("../config")) {
    this.game = game;
    this.config = config;

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
        if (this.game.engine.isPointerLock) {
          this.game.engine.exitPointerlock();
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
    if (this.game["canvas"]) {
      this.game["canvas"].addEventListener("click", () => {
        if (!this.isTabMenuOpen && !this.game.engine.isPointerLock) {
          this.game.engine.enterPointerlock();
        }
      });
    }
  }

  private updateStatsTabData(): void {
    if (
      !this.tabMenu ||
      this.tabMenu.classList.contains("hidden") ||
      this.currentActiveTab !== TAB_MENU_CONFIG.PLAYER_STATS_TAB_ID
    ) {
      return;
    }
    const currentHealthGame = this.game.playerManager.getCurrentHealth();
    const maxHealthGame = this.game.playerManager.getMaxHealth();
    const currentStaminaGame = this.game.playerManager.getCurrentStamina();
    const maxStaminaGame = this.game.playerManager.getMaxStamina();
    const placeholderCurrentExp =
      TAB_MENU_CONFIG.PLACEHOLDER_PLAYER_CURRENT_EXP;

    if (this.playerLevelDisplay) {
      this.playerLevelDisplay.textContent = this.tabPlayerData.level.toString();
    }
    if (this.playerHealthDisplay) {
      this.playerHealthDisplay.textContent = `${currentHealthGame.toFixed(
        0
      )} / ${maxHealthGame.toFixed(0)}`;
    }
    if (this.playerStaminaDisplay) {
      this.playerStaminaDisplay.textContent = `${currentStaminaGame.toFixed(
        0
      )} / ${maxStaminaGame.toFixed(0)}`;
    }
    if (this.playerExperienceDisplay) {
      this.playerExperienceDisplay.textContent = `${placeholderCurrentExp} / ${this.tabPlayerData.experienceToNextLevel}`;
    }
    if (this.ingameTimeDisplayTab) {
      this.ingameTimeDisplayTab.textContent =
        this.game.skyManager.getCurrentTimeFormatted();
    }
    if (this.experienceBarFillTab) {
      this.experienceBarFillTab.style.width = `${
        (placeholderCurrentExp / this.tabPlayerData.experienceToNextLevel) * 100
      }%`;
    }
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
    this.game.hudManager.hideCoreHud();
    if (this.game.engine.isPointerLock) {
      this.game.engine.exitPointerlock();
    }
    this.setActiveTab(
      tabIdToShow || this.currentActiveTab || TAB_MENU_CONFIG.INITIAL_ACTIVE_TAB
    );
  }

  private hideTabMenu(): void {
    this.isTabMenuOpen = false;
    this.tabMenu.classList.add("hidden");
    this.game.hudManager.showCoreHud();
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
