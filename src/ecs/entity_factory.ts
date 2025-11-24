import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import * as YUKA from "yuka";
import { SpiderAssembler } from "./assemblers/spider_assembler";

export class EntityFactory {
  private spiderAssembler: SpiderAssembler;

  constructor(scene: Scene, entityManager: YUKA.EntityManager) {
    this.spiderAssembler = new SpiderAssembler(scene, entityManager);
  }

  public async createSpider(initialPosition: Vector3): Promise<void> {
    return this.spiderAssembler.create(initialPosition);
  }
}
