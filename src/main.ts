import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

import { UI_ELEMENT_IDS } from "./config";
import { Game } from "./game";
import { ConsoleManager } from "./console_manager";

const canvas = document.getElementById(
  UI_ELEMENT_IDS.RENDER_CANVAS
) as HTMLCanvasElement;

const game = new Game(canvas);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const consoleManager = new ConsoleManager(
  game.skyManager,
  game.hudManager,
  game.inputManager
);

window.addEventListener("resize", () => {
  game.engine.resize();
});

await game.start();
