import { Scene } from "@babylonjs/core/scene";
import { PlayerManager } from "../player_manager";
import { HealthSystem } from "./systems/health_system";

export class GameSystems {
    private healthSystem: HealthSystem;

    constructor(_scene: Scene, playerManager: PlayerManager) {
        // _scene passed for future systems
        this.healthSystem = new HealthSystem(playerManager);
    }
    
    public update(_dt: number) {
        this.healthSystem.update();
    }
}

