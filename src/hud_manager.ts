import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";

import { UI_ELEMENT_IDS } from "./config";

export class HUDManager {
  // Renamed from UIManager
  private engine: Engine;
  private scene: Scene;

  // Core HUD Elements
  private fpsDisplay: HTMLElement;
  private staminaText: HTMLElement;
  private staminaBarFill: HTMLElement;
  private healthText: HTMLElement;
  private healthBarFill: HTMLElement;
  private bloodScreenEffect: HTMLElement;
  private hitEffectOverlay: HTMLElement;
  private crosshairElement: HTMLElement;
  private deathScreen: HTMLElement;

  // Enemy Info HUD Elements
  private enemyInfoContainer: HTMLElement;
  private enemyHealthText: HTMLElement;
  private enemyHealthBarFill: HTMLElement;
  private enemyNameText: HTMLElement;
  private enemyLevelText: HTMLElement;

  private mainUiContainer: HTMLElement;

  constructor(engine: Engine, scene: Scene) {
    this.engine = engine;
    this.scene = scene;

    this.fpsDisplay = document.getElementById(UI_ELEMENT_IDS.FPS_DISPLAY)!;
    this.staminaText = document.getElementById(UI_ELEMENT_IDS.STAMINA_TEXT)!;
    this.staminaBarFill = document.getElementById(
      UI_ELEMENT_IDS.STAMINA_BAR_FILL
    )!;
    this.healthText = document.getElementById(UI_ELEMENT_IDS.HEALTH_TEXT)!;
    this.healthBarFill = document.getElementById(
      UI_ELEMENT_IDS.HEALTH_BAR_FILL
    )!;
    this.bloodScreenEffect = document.getElementById(
      UI_ELEMENT_IDS.BLOOD_SCREEN_EFFECT
    )!;
    this.hitEffectOverlay = document.getElementById(
      UI_ELEMENT_IDS.HIT_EFFECT_OVERLAY
    )!;
    this.crosshairElement = document.getElementById(UI_ELEMENT_IDS.CROSSHAIR)!;
    this.deathScreen = document.getElementById(UI_ELEMENT_IDS.DEATH_SCREEN)!;

    this.enemyInfoContainer = document.getElementById(
      UI_ELEMENT_IDS.ENEMY_INFO_CONTAINER
    )!;
    this.enemyHealthText = document.getElementById(
      UI_ELEMENT_IDS.ENEMY_HEALTH_TEXT
    )!;
    this.enemyHealthBarFill = document.getElementById(
      UI_ELEMENT_IDS.ENEMY_HEALTH_BAR_FILL
    )!;
    this.enemyNameText = document.getElementById(
      UI_ELEMENT_IDS.ENEMY_NAME_TEXT
    )!;
    this.enemyLevelText = document.getElementById(
      UI_ELEMENT_IDS.ENEMY_LEVEL_TEXT
    )!;

    this.mainUiContainer = document.getElementById(
      UI_ELEMENT_IDS.UI_CONTAINER
    )!;
  }

  public updatePlayerStats(
    currentHealth: number,
    maxHealth: number,
    currentStamina: number,
    maxStamina: number
  ): void {
    this.healthText.textContent = `${currentHealth.toFixed(
      0
    )}/${maxHealth.toFixed(0)}`;
    this.healthBarFill.style.width = `${(currentHealth / maxHealth) * 100}%`;

    this.staminaText.textContent = `${currentStamina.toFixed(
      0
    )}/${maxStamina.toFixed(0)}`;
    this.staminaBarFill.style.width = `${(currentStamina / maxStamina) * 100}%`;

    this.updateBloodOverlay(currentHealth, maxHealth);
  }

  private updateBloodOverlay(currentHealth: number, maxHealth: number): void {
    const hpRatio = currentHealth / maxHealth;
    if (hpRatio >= 0.5) {
      this.bloodScreenEffect.style.opacity = "0";
      return;
    }
    // Only show overlay below 50% HP, interpolate from 0 (at 50%) to 1 (at 0%)
    const t = 1 - hpRatio / 0.5; // t = 0 at 0.5, t = 1 at 0
    const opacity = t; // Linear, or tweak for curve if desired
    this.bloodScreenEffect.style.opacity = opacity.toString();
  }

  public updateFPS(): void {
    this.fpsDisplay.textContent = "FPS: " + this.engine.getFps().toFixed();
  }

  public showBloodScreenEffect(
    duration: number = 200,
    intensity: number = 0.3
  ): void {
    this.hitEffectOverlay.style.background = `rgba(255, 0, 0, ${intensity})`;
    setTimeout(() => {
      this.hitEffectOverlay.style.background = "rgba(255, 0, 0, 0)";
    }, duration);
  }

  public showEnemyInfo(
    name: string,
    level: number,
    currentHealth: number,
    maxHealth: number
  ): void {
    this.enemyNameText.textContent = name;
    this.enemyLevelText.textContent = `| Lvl ${level}`;
    this.enemyHealthText.textContent = `${currentHealth.toFixed(
      0
    )}/${maxHealth}`;
    this.enemyHealthBarFill.style.width = `${
      (currentHealth / maxHealth) * 100
    }%`;
    this.enemyInfoContainer.style.display = "block";
  }

  public hideEnemyInfo(): void {
    this.enemyInfoContainer.style.display = "none";
  }

  public setCrosshairText(text: string): void {
    this.crosshairElement.textContent = text;
  }

  public setCrosshairFocus(isFocused: boolean): void {
    if (isFocused) {
      this.crosshairElement.classList.add("crosshair-enemy-focus");
    } else {
      this.crosshairElement.classList.remove("crosshair-enemy-focus");
    }
  }

  public showDeathScreen(): void {
    this.deathScreen.classList.remove("hidden");
  }

  public hideDeathScreen(): void {
    this.deathScreen.classList.add("hidden");
  }

  public toggleInspector(): void {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
    } else {
      this.scene.debugLayer.show();
    }
  }

  public hideCoreHud(): void {
    this.mainUiContainer.classList.add("hidden");
    this.fpsDisplay.classList.add("hidden");
    this.enemyInfoContainer.classList.add("hidden");
    this.crosshairElement.classList.add("hidden");
  }

  public showCoreHud(): void {
    this.mainUiContainer.classList.remove("hidden");
    this.fpsDisplay.classList.remove("hidden");
    this.crosshairElement.classList.remove("hidden");
  }
}
