import { Scene } from "@babylonjs/core/scene";
import { PlayerManager } from "../player_manager";
import { HUDManager } from "../hud_manager";
import { HealthSystem } from "./systems/health_system";
import { EnemyAISystem } from "./systems/enemy_ai_system";
import { PhysicsSyncSystem } from "./systems/physics_sync_system";
import { AnimationSystem } from "./systems/animation_system";
import { CombatSystem } from "./systems/combat_system";
import { InteractionSystem, TargetEvent } from "./systems/interaction_system";
import { InputSystem } from "./systems/input_system";
import { PlayerControlSystem } from "./systems/player_control_system";
import { TimerSystem } from "./systems/timer_system";
import { PlayerStateSystem } from "./systems/player_state_system";
import { SensorSystem } from "./systems/sensor_system";

export class GameSystems {
    private healthSystem: HealthSystem;
    private enemyAISystem: EnemyAISystem;
    private physicsSyncSystem: PhysicsSyncSystem;
    private animationSystem: AnimationSystem;
    private combatSystem: CombatSystem;
    private interactionSystem: InteractionSystem;
    private inputSystem: InputSystem;
    private playerControlSystem: PlayerControlSystem;
    private timerSystem: TimerSystem;
    private playerStateSystem: PlayerStateSystem;
    private sensorSystem: SensorSystem;

    constructor(scene: Scene, playerManager: PlayerManager, hudManager: HUDManager) {
        this.healthSystem = new HealthSystem();
        this.enemyAISystem = new EnemyAISystem();
        this.physicsSyncSystem = new PhysicsSyncSystem();
        this.animationSystem = new AnimationSystem();
        this.combatSystem = new CombatSystem();
        this.inputSystem = new InputSystem(playerManager.inputManager, playerManager.camera); 
        this.playerControlSystem = new PlayerControlSystem(scene);
        this.timerSystem = new TimerSystem();
        this.playerStateSystem = new PlayerStateSystem(hudManager);
        this.sensorSystem = new SensorSystem();
        
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
        this.enemyAISystem.update();
        this.combatSystem.update(dt);
        this.physicsSyncSystem.update();
        this.animationSystem.update();
        this.interactionSystem.update(isDebugMode);
    }
}
