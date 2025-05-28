import { SkyManager } from "./sky_manager";
import { HUDManager } from "./hud_manager";
import { KEY_MAPPINGS } from "./config";
import { InputManager } from "./input_manager";

export class ConsoleManager {
  private skyManager: SkyManager;
  private hudManager: HUDManager;
  private inputManager: InputManager;

  constructor(
    skyManager: SkyManager,
    hudManager: HUDManager,
    inputManager: InputManager
  ) {
    this.skyManager = skyManager;
    this.hudManager = hudManager;
    this.inputManager = inputManager;
    this.registerConsoleToggle();
  }

  private registerConsoleToggle(): void {
    const toggleConsoleAction = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === KEY_MAPPINGS.TOGGLE_CONSOLE ||
        (event.shiftKey && event.key === "~")
      ) {
        event.preventDefault();
        const input = window.prompt("Enter command:");
        if (input) {
          this.handleConsoleCommand(input);
        }
      }
    };
    this.inputManager.registerKeyAction(
      KEY_MAPPINGS.TOGGLE_CONSOLE,
      toggleConsoleAction
    );
  }

  public handleConsoleCommand(command: string): void {
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
          this.skyManager.setTime(hours, minutes);
        } else {
          console.error(
            "Invalid time format or value for set_time. Use HH:MM (00:00 - 23:59)."
          );
        }
      }
    } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_INSPECTOR) {
      this.hudManager.toggleInspector();
    } else if (lowerCommand === KEY_MAPPINGS.TOGGLE_DEBUG) {
      console.log(`Debug mode toggled (handled in Game.update loop).`);
    } else {
      console.log(`Unknown command: ${command}`);
    }
  }

  public dispose(): void {
    // It's good practice to unregister actions when the manager is disposed
    // However, the current registerConsoleToggle logic would need to store the action function
    // to unregister it specifically. For now, we'll rely on InputManager.dispose() to clear all.
    // If specific unregistration is needed later, toggleConsoleAction can be stored as a member.
  }
}
