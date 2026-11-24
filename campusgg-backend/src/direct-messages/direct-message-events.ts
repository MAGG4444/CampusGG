import { Injectable, Logger } from '@nestjs/common';

type Listener = (users: readonly string[]) => void;

@Injectable()
export class DirectMessageEvents {
  private readonly listeners = new Set<Listener>();
  private readonly logger = new Logger(DirectMessageEvents.name);

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(sender: string, recipient: string): void {
    const users = [...new Set([sender.toLowerCase(), recipient.toLowerCase()])];
    for (const listener of this.listeners) {
      try {
        listener(users);
      } catch (error) {
        this.logger.warn(
          `Direct message notification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }
}
