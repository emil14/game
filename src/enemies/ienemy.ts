import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";

export interface IEnemy {
  name: string;
  level: number;
  maxHealth: number;
  currentHealth: number;
  colliderMesh: Mesh;
  visualMesh: AbstractMesh;
  setOnPlayerDamaged(callback: (damage: number) => void): void;
  update(deltaTime: number, playerCamera: FreeCamera): void;
  takeDamage(amount: number): void;
  getIsAggro(): boolean;
  getIsDying(): boolean;
  dispose(): void;
}
