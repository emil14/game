import { world } from "../world";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { RayHelper } from "@babylonjs/core/Debug/rayHelper";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

// Event payload for UI updates
export type TargetEvent = {
    type: "none" | "enemy" | "interactable";
    name?: string;
    health?: number;
    maxHealth?: number;
    level?: number;
    icon?: string;
    isDead?: boolean;
};

export class InteractionSystem {
  private scene: Scene;
  private debugRayHelper: RayHelper | null = null;
  private onTargetChanged: (event: TargetEvent) => void;
  private lastTargetId: string | null = null;

  constructor(scene: Scene, onTargetChanged: (event: TargetEvent) => void) {
      this.scene = scene;
      this.onTargetChanged = onTargetChanged;
  }

  public update(isDebugMode: boolean) {
      const player = world.with("player", "sensor").first;
      
      if (!player || !player.sensor) return;

      const sensor = player.sensor;

      // Debug Visuals
      if (isDebugMode) {
          const camera = player.player?.camera;
          if (camera) {
              // Visualizing the sensor ray is complex since it's calculated elsewhere.
              // We can skip it or re-calculate for debug only.
          }
      }

      // Check Sensor Result
      if (sensor.hitEntity) {
          const entity = sensor.hitEntity;
          if (entity.enemy && entity.health) {
             const isDead = entity.health.current <= 0;
             this.notify({
                 type: "enemy",
                 name: entity.enemy.type,
                 health: entity.health.current,
                 maxHealth: entity.health.max,
                 level: 1,
                 isDead: isDead
             });
             return;
          }
      } else if (sensor.hitMetadata?.interactableType === "chest") {
           // Legacy support using passed metadata
           const chest = sensor.hitMetadata.chestInstance;
           if (chest) {
               this.notify({
                   type: "interactable",
                   icon: chest.getDisplayIcon()
               });
               return;
           }
      }
      
      this.clearTarget();
  }

  // Legacy handleHit method removed as logic is now inline above.

  private clearTarget() {
      if (this.lastTargetId !== "none") {
          this.notify({ type: "none" });
      }
  }

  private notify(event: TargetEvent) {
      // Simple dedupe to avoid spamming UI updates
      const eventId = event.type + (event.name || "") + (event.health || "");
      if (this.lastTargetId === eventId) return;
      
      this.lastTargetId = eventId;
      this.onTargetChanged(event);
  }
}
