import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import * as YUKA from "yuka";
import { SpiderAssembler } from "./assemblers/spider_assembler";
import { PlayerAssembler } from "./assemblers/player_assembler";

export class EntityFactory {
  private spiderAssembler: SpiderAssembler;
  private playerAssembler: PlayerAssembler;

  constructor(scene: Scene, entityManager: YUKA.EntityManager, camera: UniversalCamera) {
    this.spiderAssembler = new SpiderAssembler(scene, entityManager);
    this.playerAssembler = new PlayerAssembler(scene, camera);
  }

  public async createSpider(initialPosition: Vector3): Promise<void> {
    return this.spiderAssembler.create(initialPosition);
  }

  public async createPlayer(): Promise<void> {
    return this.playerAssembler.create();
  }
}
