import { Scene } from "@babylonjs/core/scene";
import { PlayerManager } from "../player_manager";
import { HUDManager } from "../hud_manager";
import { HealthSystem } from "./systems/health_system";
import { EnemyAISystem } from "./systems/enemy_ai_system";
import { PhysicsSyncSystem } from "./systems/physics_sync_system";
import { AnimationSystem } from "./systems/animation_system";
import { CombatSystem } from "./systems/combat_system";
import { InteractionSystem, TargetEvent } from "./systems/interaction_system";

export class GameSystems {
    private healthSystem: HealthSystem;
    private enemyAISystem: EnemyAISystem;
    private physicsSyncSystem: PhysicsSyncSystem;
    private animationSystem: AnimationSystem;
    private combatSystem: CombatSystem;
    private interactionSystem: InteractionSystem;

    constructor(scene: Scene, playerManager: PlayerManager, hudManager: HUDManager) {
        this.healthSystem = new HealthSystem(playerManager);
        this.enemyAISystem = new EnemyAISystem();
        this.physicsSyncSystem = new PhysicsSyncSystem();
        this.animationSystem = new AnimationSystem();
        this.combatSystem = new CombatSystem();
        
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
        this.healthSystem.update();
        this.enemyAISystem.update();
        this.combatSystem.update(dt);
        this.physicsSyncSystem.update();
        this.animationSystem.update();
        this.interactionSystem.update(isDebugMode);
    }
}
