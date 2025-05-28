import { KEY_MAPPINGS } from "./config";

export type KeyAction = (event: KeyboardEvent) => void;

export class InputManager {
  private keysPressed: Set<string> = new Set();
  private mouseButtonsPressed: Set<number> = new Set();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private keyActions: Map<string, KeyAction[]> = new Map(); // Stores actions for keys

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    window.addEventListener("keyup", this.handleKeyUp.bind(this));

    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));

    // Prevent context menu on right-click, which is often used for alternative actions
    this.canvas.addEventListener("contextmenu", (event) =>
      event.preventDefault()
    );
  }

  public registerKeyAction(key: string, action: KeyAction): void {
    const lowerKey = key.toLowerCase();
    if (!this.keyActions.has(lowerKey)) {
      this.keyActions.set(lowerKey, []);
    }
    this.keyActions.get(lowerKey)?.push(action);
  }

  public unregisterKeyAction(key: string, action: KeyAction): void {
    const lowerKey = key.toLowerCase();
    if (this.keyActions.has(lowerKey)) {
      const actions = this.keyActions.get(lowerKey);
      if (actions) {
        const index = actions.indexOf(action);
        if (index > -1) {
          actions.splice(index, 1);
        }
        if (actions.length === 0) {
          this.keyActions.delete(lowerKey);
        }
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keysPressed.add(key);
    this.keysPressed.add(event.code); // Also store by event.code for physical key mapping if needed

    // Execute registered actions for this key
    if (this.keyActions.has(key)) {
      this.keyActions.get(key)?.forEach((action) => action(event));
    }

    // Prevent default browser action for specific game keys
    if (
      key === KEY_MAPPINGS.OPEN_TAB_MENU ||
      key === KEY_MAPPINGS.JUMP || // Spacebar often scrolls
      key === KEY_MAPPINGS.TOGGLE_CONSOLE
    ) {
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keysPressed.delete(event.key.toLowerCase());
    this.keysPressed.delete(event.code);
  }

  private handleMouseDown(event: MouseEvent): void {
    this.mouseButtonsPressed.add(event.button);
  }

  private handleMouseUp(event: MouseEvent): void {
    this.mouseButtonsPressed.delete(event.button);
  }

  private handleMouseMove(event: MouseEvent): void {
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  public isKeyPressed(key: string): boolean {
    return this.keysPressed.has(key.toLowerCase());
  }

  public isKeyCodePressed(code: string): boolean {
    return this.keysPressed.has(code);
  }

  public isMouseButtonPressed(button: number): boolean {
    return this.mouseButtonsPressed.has(button);
  }

  public getMousePosition(): { x: number; y: number } {
    return this.mousePosition;
  }

  // Call this to remove listeners when the game ends or manager is disposed
  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    window.removeEventListener("keyup", this.handleKeyUp.bind(this));

    this.canvas.removeEventListener(
      "mousedown",
      this.handleMouseDown.bind(this)
    );
    this.canvas.removeEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.removeEventListener(
      "mousemove",
      this.handleMouseMove.bind(this)
    );
    this.canvas.removeEventListener("contextmenu", (event) =>
      event.preventDefault()
    );
    this.keyActions.clear(); // Clear actions on dispose
  }
}
