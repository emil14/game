export type EventHandler<T = any> = (payload: T) => void;

export class EventSystem {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  on<T = any>(event: string, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
  }

  off<T = any>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)!.delete(handler as EventHandler);
  }

  emit<T = any>(event: string, payload: T): void {
    for (const handler of this.listeners.get(event)!) {
      handler(payload);
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
