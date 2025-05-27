import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Collisions/collisionCoordinator";
import "@babylonjs/inspector";

import { UI_ELEMENT_IDS, KEY_MAPPINGS, TAB_MENU_CONFIG } from "./config";
import { Game } from "./game";

const canvas = document.getElementById(
  UI_ELEMENT_IDS.RENDER_CANVAS
) as HTMLCanvasElement;

const game = new Game(canvas);

window.addEventListener("resize", () => {
  game.engine.resize();
});

document.addEventListener("DOMContentLoaded", () => {
  // No tab menu logic here anymore; it will be managed by TabMenuManager inside Game.
});

function handleConsoleCommand(command: string): void {
  if (!command) {
    return;
  }
  const lowerCommand = command.toLowerCase();
  if (lowerCommand.startsWith("set_time ")) {
    const timeString = command.substring("set_time ".length);
    const timeParts = timeString.split(":");
    if (timeParts.length === 2) {
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      if (
        !isNaN(hours) &&
        !isNaN(minutes) &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
      ) {
        game.skyManager.setTime(hours, minutes);
      } else {
        console.error(
          "Invalid time format or value for set_time. Use HH:MM (00:00 - 23:59)."
        );
      }
    }
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_INSPECTOR) {
    game.hudManager.toggleInspector();
  } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_DEBUG) {
    console.log(`Debug mode toggled (handled in Game.update loop).`);
  } else {
    console.log(`Unknown command: ${command}`);
  }
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === KEY_MAPPINGS.TOGGLE_CONSOLE || (event.shiftKey && key === "~")) {
    const input = window.prompt("Enter command:");
    if (input) handleConsoleCommand(input);
  }
});

await game.start();
