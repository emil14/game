import { Mesh } from "@babylonjs/core/Meshes/mesh";

export interface PlayerInventory {
  keys: Set<string>; // Set of key IDs the player possesses
}

// Simple global player inventory for now
export const playerInventory: PlayerInventory = {
  keys: new Set<string>(),
};

// Function to simulate player acquiring a key
export function playerAcquiresKey(keyId: string) {
  playerInventory.keys.add(keyId);
}

// Function to check if player has a key
export function playerHasKey(keyId: string): boolean {
  return playerInventory.keys.has(keyId);
}

export class Chest {
  public mesh: Mesh;
  public isLocked: boolean;
  public requiredKeyId: string | null; // null if no key is required (e.g., already unlocked or opens freely)
  public onOpen?: () => void; // Optional callback when opened

  constructor(
    mesh: Mesh,
    isLocked: boolean = true,
    requiredKeyId: string | null = null,
    onOpen?: () => void
  ) {
    this.mesh = mesh; // This would typically be the collider mesh
    this.isLocked = isLocked;
    this.requiredKeyId = requiredKeyId;
    this.onOpen = onOpen;

    // Associate this chest instance with the mesh, e.g., using metadata
    this.mesh.metadata = this.mesh.metadata || {};
    this.mesh.metadata.interactableType = "chest";
    this.mesh.metadata.chestInstance = this;
  }

  public getDisplayIcon(): string {
    if (!this.isLocked) {
      return "🔓"; // Already unlocked
    }
    if (this.requiredKeyId && playerHasKey(this.requiredKeyId)) {
      return "🔓"; // Locked, but player has the key
    }
    return "🔒"; // Locked, player does not have the key
  }

  public attemptOpen(): boolean {
    if (!this.isLocked) {
      if (this.onOpen) this.onOpen();
      return true; // Already open
    }

    if (this.requiredKeyId && !playerHasKey(this.requiredKeyId)) {
      return false; // Locked, key missing
    }

    // Has key or no key required (though first check covers !isLocked)
    this.isLocked = false;
    if (this.onOpen) {
      this.onOpen();
    }

    // Here you might change the chest's appearance (e.g., swap model to an open chest)
    // For now, just update state.

    return true;
  }
}
