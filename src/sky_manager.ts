import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SkyMaterial } from "@babylonjs/materials/sky";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { WORLD_CONFIG, ASSET_PATHS } from "./config";

export class SkyManager {
  private scene: Scene;

  // Lights
  private hemisphericLight: HemisphericLight;
  private sunLight: DirectionalLight;
  private moonLight: DirectionalLight;

  // Sky materials and meshes
  private skyboxMaterial: SkyMaterial;
  private nightSkyboxMaterial: StandardMaterial;
  private daySkybox: Mesh;
  private nightSkybox: Mesh;
  private moonPlane: Mesh;
  private moonMaterial: StandardMaterial;

  // Time tracking
  private currentCycleTime: number;
  private readonly CYCLE_DURATION_SECONDS = WORLD_CONFIG.CYCLE_DURATION_SECONDS;

  // Time points
  private readonly NEW_SUNRISE_HOUR = WORLD_CONFIG.NEW_SUNRISE_HOUR;
  private readonly NEW_SUNSET_HOUR = WORLD_CONFIG.NEW_SUNSET_HOUR;
  private readonly newSunrisePoint = this.NEW_SUNRISE_HOUR / 24;
  private readonly newSunsetPoint = this.NEW_SUNSET_HOUR / 24;
  private readonly newMiddayPoint =
    (this.newSunrisePoint + this.newSunsetPoint) / 2;
  private readonly dayNightTransitionWidth =
    WORLD_CONFIG.DAY_NIGHT_TRANSITION_WIDTH_HOURS_PORTION;

  // Sun/moon angles
  private readonly sunAngleNight = WORLD_CONFIG.SUN_ANGLE_NIGHT;
  private readonly sunAngleHorizon = WORLD_CONFIG.SUN_ANGLE_HORIZON;
  private readonly sunAnglePeak = WORLD_CONFIG.SUN_ANGLE_PEAK;

  constructor(scene: Scene) {
    this.scene = scene;

    // Initialize current cycle time
    this.currentCycleTime =
      this.CYCLE_DURATION_SECONDS * WORLD_CONFIG.INITIAL_CYCLE_TIME_PROGRESS;

    // Create lights
    this.hemisphericLight = new HemisphericLight(
      "light1",
      new Vector3(0, 1, 0),
      scene
    );
    this.hemisphericLight.intensity = 0.7;

    this.sunLight = new DirectionalLight(
      "sunLight",
      new Vector3(0, -1, 0),
      scene
    );
    this.sunLight.intensity = 1.0;
    this.sunLight.diffuse = new Color3(1, 0.9, 0.7);
    this.sunLight.specular = new Color3(1, 1, 0.8);

    this.moonLight = new DirectionalLight(
      "moonLight",
      new Vector3(0, -1, 0),
      scene
    );
    this.moonLight.intensity = 0;
    this.moonLight.diffuse = new Color3(0.7, 0.8, 1.0);
    this.moonLight.specular = new Color3(0.8, 0.9, 1.0);

    // Create day skybox material
    this.skyboxMaterial = new SkyMaterial("skyBoxMaterial", scene);
    this.skyboxMaterial.backFaceCulling = false;
    this.skyboxMaterial.turbidity = WORLD_CONFIG.SKYBOX_TURBIDITY;
    this.skyboxMaterial.mieDirectionalG = WORLD_CONFIG.SKYBOX_MIE_DIRECTIONAL_G;
    this.skyboxMaterial.useSunPosition = true;
    this.skyboxMaterial.azimuth = WORLD_CONFIG.SKYBOX_AZIMUTH;
    this.skyboxMaterial.luminance = WORLD_CONFIG.SKYBOX_LUMINANCE;
    this.skyboxMaterial.disableDepthWrite = true;

    // Create night skybox material
    this.nightSkyboxMaterial = new StandardMaterial(
      "nightSkyboxMaterial",
      scene
    );
    this.nightSkyboxMaterial.backFaceCulling = false;
    this.nightSkyboxMaterial.reflectionTexture = new CubeTexture(
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
    if (this.nightSkyboxMaterial.reflectionTexture) {
      this.nightSkyboxMaterial.reflectionTexture.coordinatesMode =
        Texture.SKYBOX_MODE;
    }
    this.nightSkyboxMaterial.disableLighting = true;
    this.nightSkyboxMaterial.alpha = 0.0;
    this.nightSkyboxMaterial.disableDepthWrite = true;

    // Create day skybox mesh
    this.daySkybox = MeshBuilder.CreateBox(
      "daySkyBox",
      { size: WORLD_CONFIG.GROUND_SIZE * 20 },
      scene
    );
    this.daySkybox.material = this.skyboxMaterial;
    this.daySkybox.infiniteDistance = true;

    // Create night skybox mesh
    this.nightSkybox = MeshBuilder.CreateBox(
      "nightSkybox",
      { size: WORLD_CONFIG.GROUND_SIZE * 20 },
      scene
    );
    this.nightSkybox.material = this.nightSkyboxMaterial;
    this.nightSkybox.infiniteDistance = true;

    // Create moon
    const moonTexture = new Texture(ASSET_PATHS.MOON_TEXTURE, scene);
    this.moonMaterial = new StandardMaterial("moonMaterial", scene);
    this.moonMaterial.diffuseTexture = moonTexture;
    this.moonMaterial.emissiveTexture = moonTexture;
    this.moonMaterial.disableLighting = true;
    this.moonMaterial.backFaceCulling = false;
    this.moonMaterial.alpha = 1.0;

    this.moonPlane = MeshBuilder.CreatePlane("moonPlane", { size: 32 }, scene);
    this.moonPlane.material = this.moonMaterial;
    this.moonPlane.infiniteDistance = true;
    this.moonPlane.isPickable = false;
    this.moonPlane.alwaysSelectAsActiveMesh = false;
    this.moonPlane.visibility = 0;
    this.moonPlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  }

  public update(deltaTime: number): void {
    // Update cycle time
    this.currentCycleTime =
      (this.currentCycleTime + deltaTime) % this.CYCLE_DURATION_SECONDS;
    const cycleProgress = this.currentCycleTime / this.CYCLE_DURATION_SECONDS;

    // Calculate transition points
    const sr_transition_start =
      this.newSunrisePoint - this.dayNightTransitionWidth;
    const sr_transition_end =
      this.newSunrisePoint + this.dayNightTransitionWidth;
    const ss_transition_start =
      this.newSunsetPoint - this.dayNightTransitionWidth;
    const ss_transition_end =
      this.newSunsetPoint + this.dayNightTransitionWidth;

    // Calculate target values based on time of day
    let targetInclination: number;
    let targetHemisphericIntensity: number;
    let targetSunLightIntensity: number;
    let targetDaySkyLuminance: number;
    let targetNightSkyAlpha: number;

    if (
      cycleProgress >= sr_transition_start &&
      cycleProgress < sr_transition_end
    ) {
      // Sunrise transition
      const transProgress =
        (cycleProgress - sr_transition_start) /
        (this.dayNightTransitionWidth * 2);
      targetInclination =
        this.sunAngleNight +
        transProgress * (this.sunAngleHorizon - this.sunAngleNight);
      targetHemisphericIntensity = 0.05 + transProgress * 0.65;
      targetSunLightIntensity = transProgress * 1.0;
      targetDaySkyLuminance = 0.005 + transProgress * (1.0 - 0.005);
      targetNightSkyAlpha = 1.0 - transProgress;
    } else if (
      cycleProgress >= ss_transition_start &&
      cycleProgress < ss_transition_end
    ) {
      // Sunset transition
      const transProgress =
        (cycleProgress - ss_transition_start) /
        (this.dayNightTransitionWidth * 2);
      targetInclination =
        this.sunAngleHorizon -
        transProgress * (this.sunAngleHorizon - this.sunAngleNight);
      targetHemisphericIntensity = 0.7 - transProgress * 0.65;
      targetSunLightIntensity = 1.0 - transProgress * 1.0;
      targetDaySkyLuminance = 1.0 - transProgress * (1.0 - 0.005);
      targetNightSkyAlpha = transProgress;
    } else if (
      cycleProgress >= sr_transition_end &&
      cycleProgress < ss_transition_start
    ) {
      // Daytime
      targetHemisphericIntensity = 0.7;
      targetSunLightIntensity = 1.0;
      targetDaySkyLuminance = 1.0;
      targetNightSkyAlpha = 0.0;

      if (cycleProgress < this.newMiddayPoint) {
        // Morning
        const morningProgress =
          (cycleProgress - sr_transition_end) /
          (this.newMiddayPoint - sr_transition_end);
        targetInclination =
          this.sunAngleHorizon +
          morningProgress * (this.sunAnglePeak - this.sunAngleHorizon);
      } else {
        // Afternoon
        const afternoonProgress =
          (cycleProgress - this.newMiddayPoint) /
          (ss_transition_start - this.newMiddayPoint);
        targetInclination =
          this.sunAnglePeak -
          afternoonProgress * (this.sunAnglePeak - this.sunAngleHorizon);
      }
      targetInclination = Math.max(
        this.sunAngleHorizon,
        Math.min(this.sunAnglePeak, targetInclination)
      );
    } else {
      // Nighttime
      targetInclination = this.sunAngleNight;
      targetHemisphericIntensity = 0.05;
      targetSunLightIntensity = 0;
      targetDaySkyLuminance = 0.005;
      targetNightSkyAlpha = 1.0;
    }

    // Apply sky properties
    this.skyboxMaterial.inclination = targetInclination;
    this.hemisphericLight.intensity = targetHemisphericIntensity;
    this.sunLight.intensity = targetSunLightIntensity;
    this.skyboxMaterial.luminance = targetDaySkyLuminance;
    this.nightSkyboxMaterial.alpha = targetNightSkyAlpha;

    // Update sun position
    if (this.skyboxMaterial.useSunPosition) {
      const phi = this.skyboxMaterial.inclination * Math.PI;
      const theta = this.skyboxMaterial.azimuth * 2 * Math.PI;
      this.skyboxMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
      this.skyboxMaterial.sunPosition.y = Math.sin(phi);
      this.skyboxMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);
      this.sunLight.direction = this.skyboxMaterial.sunPosition.scale(-1);
    }

    // Calculate unclamped inclination for moon position
    const unclampedInclination =
      this.calculateUnclampedInclination(cycleProgress);

    // Update moon position and visibility
    const moonPhi = (unclampedInclination + 1) * Math.PI;
    const moonTheta = (this.skyboxMaterial.azimuth + 0.5) * 2 * Math.PI;
    const moonDistance = WORLD_CONFIG.MOON_DISTANCE_FROM_CAMERA;
    const moonPos = new Vector3(
      Math.cos(moonPhi) * Math.sin(moonTheta) * moonDistance,
      Math.sin(moonPhi) * moonDistance,
      Math.cos(moonPhi) * Math.cos(moonTheta) * moonDistance
    );
    this.moonPlane.position = moonPos;

    // Calculate moon visibility and lighting
    let moonVisibility = 0;
    let moonLightIntensity = 0;
    if (targetNightSkyAlpha > 0.01) {
      moonVisibility = Math.min(1, targetNightSkyAlpha * 1.2);
      moonLightIntensity = 0.4 * moonVisibility;
    }
    this.moonPlane.visibility = moonVisibility;
    this.moonLight.intensity = moonLightIntensity;
    this.moonMaterial.emissiveColor = new Color3(1, 1, 1);

    // Adjust hemispheric light intensity based on moon visibility
    this.hemisphericLight.intensity =
      targetHemisphericIntensity * (1 - 0.5 * moonVisibility);
  }

  private calculateUnclampedInclination(cycleProgress: number): number {
    const sr_transition_start =
      this.newSunrisePoint - this.dayNightTransitionWidth;
    const sr_transition_end =
      this.newSunrisePoint + this.dayNightTransitionWidth;
    const ss_transition_start =
      this.newSunsetPoint - this.dayNightTransitionWidth;
    const ss_transition_end =
      this.newSunsetPoint + this.dayNightTransitionWidth;

    if (
      cycleProgress >= sr_transition_start &&
      cycleProgress < sr_transition_end
    ) {
      const transProgress =
        (cycleProgress - sr_transition_start) /
        (this.dayNightTransitionWidth * 2);
      return (
        this.sunAngleNight +
        transProgress * (this.sunAngleHorizon - this.sunAngleNight)
      );
    } else if (
      cycleProgress >= ss_transition_start &&
      cycleProgress < ss_transition_end
    ) {
      const transProgress =
        (cycleProgress - ss_transition_start) /
        (this.dayNightTransitionWidth * 2);
      return (
        this.sunAngleHorizon -
        transProgress * (this.sunAngleHorizon - this.sunAngleNight)
      );
    } else if (
      cycleProgress >= sr_transition_end &&
      cycleProgress < ss_transition_start
    ) {
      if (cycleProgress < this.newMiddayPoint) {
        const morningProgress =
          (cycleProgress - sr_transition_end) /
          (this.newMiddayPoint - sr_transition_end);
        return (
          this.sunAngleHorizon +
          morningProgress * (this.sunAnglePeak - this.sunAngleHorizon)
        );
      } else {
        const afternoonProgress =
          (cycleProgress - this.newMiddayPoint) /
          (ss_transition_start - this.newMiddayPoint);
        return (
          this.sunAnglePeak -
          afternoonProgress * (this.sunAnglePeak - this.sunAngleHorizon)
        );
      }
    } else {
      return this.sunAngleNight;
    }
  }

  public setTime(hours: number, minutes: number): void {
    const totalMinutesInDay = 1440;
    const inputTotalMinutes = hours * 60 + minutes;
    const targetCycleProgress = inputTotalMinutes / totalMinutesInDay;
    this.currentCycleTime = targetCycleProgress * this.CYCLE_DURATION_SECONDS;

    console.log(
      `Game time set to ${String(hours).padStart(2, "0")}:${String(
        minutes
      ).padStart(2, "0")}`
    );

    // Calculate and apply immediate sky state for new time
    const sr_start = this.newSunrisePoint - this.dayNightTransitionWidth;
    const sr_end = this.newSunrisePoint + this.dayNightTransitionWidth;
    const ss_start = this.newSunsetPoint - this.dayNightTransitionWidth;
    const ss_end = this.newSunsetPoint + this.dayNightTransitionWidth;

    let targetInclinationUpdate: number;
    let targetHemisphericIntensityUpdate: number;
    let targetSunLightIntensityUpdate: number;
    let targetDaySkyLuminanceUpdate: number;
    let targetNightSkyAlphaUpdate: number;

    if (targetCycleProgress >= sr_start && targetCycleProgress < sr_end) {
      const transProgress =
        (targetCycleProgress - sr_start) / (this.dayNightTransitionWidth * 2);
      targetInclinationUpdate =
        this.sunAngleNight +
        transProgress * (this.sunAngleHorizon - this.sunAngleNight);
      targetHemisphericIntensityUpdate = 0.05 + transProgress * 0.65;
      targetSunLightIntensityUpdate = transProgress * 1.0;
      targetDaySkyLuminanceUpdate = 0.005 + transProgress * (1.0 - 0.005);
      targetNightSkyAlphaUpdate = 1.0 - transProgress;
    } else if (
      targetCycleProgress >= ss_start &&
      targetCycleProgress < ss_end
    ) {
      const transProgress =
        (targetCycleProgress - ss_start) / (this.dayNightTransitionWidth * 2);
      targetInclinationUpdate =
        this.sunAngleHorizon -
        transProgress * (this.sunAngleHorizon - this.sunAngleNight);
      targetHemisphericIntensityUpdate = 0.7 - transProgress * 0.65;
      targetSunLightIntensityUpdate = 1.0 - transProgress * 1.0;
      targetDaySkyLuminanceUpdate = 1.0 - transProgress * (1.0 - 0.005);
      targetNightSkyAlphaUpdate = transProgress;
    } else if (
      targetCycleProgress >= sr_end &&
      targetCycleProgress < ss_start
    ) {
      targetHemisphericIntensityUpdate = 0.7;
      targetSunLightIntensityUpdate = 1.0;
      targetDaySkyLuminanceUpdate = 1.0;
      targetNightSkyAlphaUpdate = 0.0;

      if (targetCycleProgress < this.newMiddayPoint) {
        const morningProgress =
          (targetCycleProgress - sr_end) / (this.newMiddayPoint - sr_end);
        targetInclinationUpdate =
          this.sunAngleHorizon +
          morningProgress * (this.sunAnglePeak - this.sunAngleHorizon);
      } else {
        const afternoonProgress =
          (targetCycleProgress - this.newMiddayPoint) /
          (ss_start - this.newMiddayPoint);
        targetInclinationUpdate =
          this.sunAnglePeak -
          afternoonProgress * (this.sunAnglePeak - this.sunAngleHorizon);
      }
      targetInclinationUpdate = Math.max(
        this.sunAngleHorizon,
        Math.min(this.sunAnglePeak, targetInclinationUpdate)
      );
    } else {
      targetInclinationUpdate = this.sunAngleNight;
      targetHemisphericIntensityUpdate = 0.05;
      targetSunLightIntensityUpdate = 0;
      targetDaySkyLuminanceUpdate = 0.005;
      targetNightSkyAlphaUpdate = 1.0;
    }

    // Apply immediate updates
    this.skyboxMaterial.inclination = targetInclinationUpdate;
    this.hemisphericLight.intensity = targetHemisphericIntensityUpdate;
    this.sunLight.intensity = targetSunLightIntensityUpdate;
    this.skyboxMaterial.luminance = targetDaySkyLuminanceUpdate;
    this.nightSkyboxMaterial.alpha = targetNightSkyAlphaUpdate;

    // Update sun position
    if (this.skyboxMaterial.useSunPosition) {
      const phi = this.skyboxMaterial.inclination * Math.PI;
      const theta = this.skyboxMaterial.azimuth * 2 * Math.PI;
      this.skyboxMaterial.sunPosition.x = Math.cos(phi) * Math.sin(theta);
      this.skyboxMaterial.sunPosition.y = Math.sin(phi);
      this.skyboxMaterial.sunPosition.z = Math.cos(phi) * Math.cos(theta);
      this.sunLight.direction = this.skyboxMaterial.sunPosition.scale(-1);
    }
  }

  public getCurrentTimeFormatted(): string {
    const cycleProgress = this.currentCycleTime / this.CYCLE_DURATION_SECONDS;
    const totalGameSecondsInDay = 86400;
    const currentTotalGameSeconds = cycleProgress * totalGameSecondsInDay;
    const gameHours = Math.floor(currentTotalGameSeconds / 3600) % 24;
    const gameMinutes = Math.floor((currentTotalGameSeconds % 3600) / 60);
    return `${gameHours.toString().padStart(2, "0")}:${gameMinutes
      .toString()
      .padStart(2, "0")}`;
  }

  public getCurrentCycleTime(): number {
    return this.currentCycleTime;
  }

  public getCycleDurationSeconds(): number {
    return this.CYCLE_DURATION_SECONDS;
  }
}
