import { World } from "miniplex";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { CharacterController } from "../lib/character_controller";

// --- Components ---

export type TransformComponent = {
  mesh: AbstractMesh;
};

export type PlayerComponent = {
  id: string;
  controller?: CharacterController;
  camera?: Camera;
};

export type EnemyComponent = {
  type: string;
  isAggro: boolean;
};

export type HealthComponent = {
  current: number;
  max: number;
};

export type StaminaComponent = {
  current: number;
  max: number;
  regenRate: number;
  depletionRate: number;
};

export type CombatComponent = {
  damage: number;
  cooldown: number;
  lastAttackTime: number;
  range: number;
};

export type PhysicsComponent = {
  // Reserved for future specialized physics state if not on Mesh
  mass: number;
};

export type AIComponent = {
  state: "idle" | "chase" | "attack" | "dead";
  target?: AbstractMesh;
};

// --- Entity Definition ---

export type Entity = {
  transform?: TransformComponent;
  player?: PlayerComponent;
  enemy?: EnemyComponent;
  health?: HealthComponent;
  stamina?: StaminaComponent;
  combat?: CombatComponent;
  physics?: PhysicsComponent;
  ai?: AIComponent;
};

// --- World ---

export const world = new World<Entity>();
