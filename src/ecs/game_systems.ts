import { Scene } from "@babylonjs/core/scene";
import { HUDManager } from "../hud_manager";
import { HealthSystem } from "./systems/health_system";
import { EnemyAISystem } from "./systems/enemy_ai_system";
import { KinematicControlSystem } from "./systems/kinematic_control_system";
import { AnimationSystem } from "./systems/animation_system";
import { CombatSystem } from "./systems/combat_system";
import { InteractionSystem, TargetEvent } from "./systems/interaction_system";
import { InputSystem } from "./systems/input_system";
import { PlayerControlSystem } from "./systems/player_control_system";
import { TimerSystem } from "./systems/timer_system";
import { PlayerStateSystem } from "./systems/player_state_system";
import { SensorSystem } from "./systems/sensor_system";
import { CameraSystem } from "./systems/camera_system";
import { GameFlowSystem } from "./systems/game_flow_system";
import { HUDSystem } from "./systems/hud_system";
import { YukaSystem } from "./systems/yuka_system";
import { AIManager } from "../ai/ai_manager";

import { InputManager } from "../input_manager";

export class GameSystems {
    private healthSystem: HealthSystem;
    private enemyAISystem: EnemyAISystem;
    private kinematicControlSystem: KinematicControlSystem;
    private animationSystem: AnimationSystem;
    private combatSystem: CombatSystem;
    private interactionSystem: InteractionSystem;
    private inputSystem: InputSystem;
    private playerControlSystem: PlayerControlSystem;
    private timerSystem: TimerSystem;
    private playerStateSystem: PlayerStateSystem;
    private sensorSystem: SensorSystem;
    private cameraSystem: CameraSystem;
    private gameFlowSystem: GameFlowSystem;
    private hudSystem: HUDSystem;
    private yukaSystem: YukaSystem;

    constructor(
        scene: Scene, 
        inputManager: InputManager, 
        hudManager: HUDManager,
        aiManager: AIManager
    ) {
        this.healthSystem = new HealthSystem();
        this.enemyAISystem = new EnemyAISystem();
        this.kinematicControlSystem = new KinematicControlSystem();
        this.animationSystem = new AnimationSystem();
        this.combatSystem = new CombatSystem();
        this.inputSystem = new InputSystem(inputManager); 
        this.playerControlSystem = new PlayerControlSystem(scene);
        this.timerSystem = new TimerSystem();
        this.playerStateSystem = new PlayerStateSystem(hudManager);
        this.sensorSystem = new SensorSystem();
        this.cameraSystem = new CameraSystem();
        this.gameFlowSystem = new GameFlowSystem();
        this.hudSystem = new HUDSystem(hudManager);
        this.yukaSystem = new YukaSystem(aiManager);
        
        // Wire Interaction -> HUD
        this.interactionSystem = new InteractionSystem(scene, (event: TargetEvent) => {
             if (event.type === "none") {
                 hudManager.hideEnemyInfo();
                 hudManager.setCrosshairFocus(false);
                 hudManager.setCrosshairText("•");
             } else if (event.type === "enemy") {
                 if (event.isDead) {
                     hudManager.setCrosshairText("✋");
                     hudManager.setCrosshairFocus(false);
                     hudManager.hideEnemyInfo();
                 } else {
                     hudManager.showEnemyInfo(
                         event.name || "Enemy", 
                         event.level || 1, 
                         event.health || 0, 
                         event.maxHealth || 100
                     );
                     hudManager.setCrosshairText("💢");
                     hudManager.setCrosshairFocus(true);
                 }
             } else if (event.type === "interactable") {
                 hudManager.setCrosshairText(event.icon || "•");
                 hudManager.setCrosshairFocus(false);
                 hudManager.hideEnemyInfo();
             }
        });
    }
    
    public update(dt: number, isDebugMode: boolean) {
        this.timerSystem.update(dt); // Run timers first (resolves delayed actions)
        this.inputSystem.update();
        this.sensorSystem.update(); // Update sensors before logic that relies on them
        this.playerControlSystem.update(dt);
        this.healthSystem.update();
        this.playerStateSystem.update(dt); // Regen logic
        
        // --- AI & Physics Orchestration ---
        this.enemyAISystem.update();    // 1. Determine Intent (State -> Behaviors)
        this.yukaSystem.update();       // 2. Calculate Steering & Desired Velocity
        this.kinematicControlSystem.update(); // 3. Apply Velocity to Havok & Sync Visuals
        
        this.combatSystem.update(dt);
        this.animationSystem.update();
        this.cameraSystem.update(dt);
        this.gameFlowSystem.update();
        this.hudSystem.update();
        this.interactionSystem.update(isDebugMode);
    }
}
