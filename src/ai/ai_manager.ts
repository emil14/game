import { EntityManager, Time } from "yuka";

export class AIManager {
  private entityManager: EntityManager;
  private time: Time;

  constructor() {
    this.entityManager = new EntityManager();
    this.time = new Time();
  }

  public update(): void {
    const delta = this.time.update().getDelta();
    this.entityManager.update(delta);
  }

  public getEntityManager(): EntityManager {
    return this.entityManager;
  }
}

