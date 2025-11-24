import { AIManager } from "../../ai/ai_manager";

export class YukaSystem {
    constructor(private aiManager: AIManager) {}

    public update() {
        // This advances the Yuka simulation (calculates steering -> velocity -> position)
        // Note: position calculated here is "theoretical" based on previous frame's sync.
        // It provides the 'velocity' that KinematicControlSystem will apply to Havok.
        this.aiManager.update();
    }
}

