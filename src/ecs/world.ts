import { World } from "miniplex";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { PhysicsAggregate } from "@babylonjs/core/Physics";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import * as YUKA from "yuka";
// CharacterController import removed

// --- Components ---

export type TransformComponent = {
  mesh: AbstractMesh; // The Physics Root (Collider)
};

export type VisualComponent = {
  mesh: AbstractMesh; // The Visual Child (Model)
  rotationOffset?: Vector3; // Euler angles to offset rotation (e.g. for glb models facing -Z)
};

import { IWeapon } from "../weapons/iweapon";

export type PlayerComponent = {
  id: string;
  camera?: Camera;
  weapon?: IWeapon;
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

import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type InputComponent = {
  moveDir: Vector3; // The desired movement direction (world space)
  isJumping: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isAttacking: boolean;
};

export type TimerComponent = {
  timeRemaining: number;
  duration: number;
  onComplete: (entity: Entity) => void;
  label?: string;
};

export type WorldStateComponent = {
  isInFightMode: boolean;
};

// --- Entity Definition ---

export type Entity = {
  timer?: TimerComponent;
  worldState?: WorldStateComponent;
  transform?: TransformComponent;
  visual?: VisualComponent;
  player?: PlayerComponent;
  input?: InputComponent; // <--- New Component
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
