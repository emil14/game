import { Vehicle } from "yuka";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3, Quaternion } from "@babylonjs/core/Maths";

export class SyncSystem {
  private entity: Vehicle;
  private mesh: AbstractMesh;

  constructor(entity: Vehicle, mesh: AbstractMesh) {
    this.entity = entity;
    this.mesh = mesh;
  }

  public update(): void {
    // Sync Yuka position to Babylon mesh
    this.mesh.position.x = this.entity.position.x;
    this.mesh.position.y = this.entity.position.y;
    this.mesh.position.z = this.entity.position.z;

    // Sync Yuka rotation to Babylon mesh
    this.mesh.rotationQuaternion = new Quaternion(
      this.entity.rotation.x,
      this.entity.rotation.y,
      this.entity.rotation.z,
      this.entity.rotation.w
    );
  }
}

