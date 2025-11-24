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
      const player = world.with("player", "transform").first;
      
      if (!player || !player.player?.camera) return;
      const camera = player.player.camera;

      // Raycast
      const origin = camera.globalPosition;
      const direction = camera.getDirection(Vector3.Forward());
      const length = 50; // Config variable ideally
      const ray = new Ray(origin, direction, length);

      // Debug Visuals
      if (isDebugMode) {
          if (!this.debugRayHelper) {
              this.debugRayHelper = RayHelper.CreateAndShow(ray, this.scene, new Color3(1, 1, 0));
          } else {
              this.debugRayHelper.ray = ray;
          }
      } else {
          this.debugRayHelper?.dispose();
          this.debugRayHelper = null;
      }

      // Perform Pick
      const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
          // Filter logic: Must have metadata with entityId OR be interactable type
          return (mesh.metadata && (mesh.metadata.entityId || mesh.metadata.interactableType));
      });

      if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
          this.handleHit(pickInfo.pickedMesh);
      } else {
          this.clearTarget();
      }
  }

  private handleHit(mesh: AbstractMesh) {
      // 1. Entity Hit (Enemy)
      if (mesh.metadata?.entityId) {
          const enemies = world.with("enemy", "health", "transform");
          let targetEntity = null;
          for (const e of enemies) {
              if (!e.transform) continue;
              // Check if this entity's transform mesh matches hit mesh
              if (e.transform.mesh === mesh || e.transform.mesh.getChildMeshes().includes(mesh as Mesh)) {
                  targetEntity = e;
                  break;
              }
          }

          if (targetEntity) {
             const isDead = targetEntity.health.current <= 0;
             this.notify({
                 type: "enemy",
                 name: targetEntity.enemy.type,
                 health: targetEntity.health.current,
                 maxHealth: targetEntity.health.max,
                 level: 1,
                 isDead: isDead
             });
             return;
          }
      }

      // 2. Interactable Hit (Chest)
      if (mesh.metadata?.interactableType === "chest") {
           // Existing logic preserved for chests (they aren't entities yet)
           const chest = mesh.metadata.chestInstance;
           this.notify({
               type: "interactable",
               icon: chest.getDisplayIcon()
           });
           return;
      }

      this.clearTarget();
  }

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
