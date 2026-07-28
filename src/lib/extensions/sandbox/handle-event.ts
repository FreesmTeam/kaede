import { EventListeners, EventSubscribers } from "@/constants/event-listeners.ts";
import type { EventListenersType } from "@/types/extensions/event-listeners.type.ts";

export function handleEvent(type: EventListenersType, value: unknown): void {
  for (const subscriber of EventSubscribers) {
    EventListeners[subscriber][type] = value;
  }
}