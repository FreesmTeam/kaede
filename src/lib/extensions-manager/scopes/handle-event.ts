import { ExtensionEvents } from "@/constants/event-listeners.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { EventListenersType } from "@/types/extensions/event-listeners.type.ts";

export function handleEvent(type: EventListenersType, value: unknown): void {
  try {
    ExtensionEvents.publish(type, value);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Failed to dispatch the '${type}' event to one or more extensions:`,
      Errors.prettify(error),
    );
  }
}
