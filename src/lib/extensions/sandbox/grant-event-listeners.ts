import {
  AllEventListeners,
  EventListeners,
  EventSubscribers,
} from "@/constants/event-listeners.ts";

export function grantEventListeners({
  id,
}: {
  "id": string;
}): void {
  EventListeners[id] = { ...AllEventListeners };
  EventSubscribers.add(id);

  return;
}