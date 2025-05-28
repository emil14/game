import { KEY_MAPPINGS } from "./config";

export class InputManager {
  private keysPressed: Set<string> = new Set();
  private mouseButtonsPressed: Set<number> = new Set();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };

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

  private handleKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keysPressed.add(key);
    this.keysPressed.add(event.code); // Also store by event.code for physical key mapping if needed

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
  }
}
