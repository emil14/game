import { World } from "miniplex";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { PhysicsAggregate } from "@babylonjs/core/Physics";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import * as YUKA from "yuka";
import { CharacterController } from "../lib/character_controller";

// --- Components ---

export type TransformComponent = {
  mesh: AbstractMesh; // The Physics Root (Collider)
};

export type VisualComponent = {
  mesh: AbstractMesh; // The Visual Child (Model)
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
  attackDuration: number;
};

export type PhysicsAggregateComponent = {
  aggregate: PhysicsAggregate;
};

export type YukaComponent = {
  vehicle: YUKA.Vehicle;
};

export type AnimationComponent = {
  idle: AnimationGroup | null;
  walk: AnimationGroup | null;
  attack: AnimationGroup | null;
  death: AnimationGroup | null;
  current?: AnimationGroup;
};

export type AIComponent = {
  state: "idle" | "chase" | "attack" | "dead";
  target?: AbstractMesh;
};

// --- Entity Definition ---

export type Entity = {
  transform?: TransformComponent;
  visual?: VisualComponent;
  player?: PlayerComponent;
  enemy?: EnemyComponent;
  health?: HealthComponent;
  stamina?: StaminaComponent;
  combat?: CombatComponent;
  physics?: PhysicsAggregateComponent;
  ai?: AIComponent;
  yuka?: YukaComponent;
  animations?: AnimationComponent;
};

// --- World ---

export const world = new World<Entity>();
