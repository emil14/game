import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

export interface IWeapon {
  visualMesh: AbstractMesh;
  attackDamage: number;
  swing(
    crosshairMaxDistance: number,
    targetFilter: (mesh: AbstractMesh) => boolean,
    onTargetHit: (targetMesh: AbstractMesh, instance?: any) => void
  ): void;
  getIsSwinging(): boolean;
  dispose(): void;
}
