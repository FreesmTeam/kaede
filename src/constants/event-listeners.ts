import { EventBroker } from "@/lib/extensions-manager/scopes/event-broker.ts";

export const AllEventListeners = {
  "all-clicks"  : true,
  "left-click"  : true,
  "middle-click": true,
  "right-click" : true,
  "routing"     : true,
  "instance"    : true,
} as const;

/** Host-owned broker. Subscriber records remain private to EventBroker. */
export const ExtensionEvents = new EventBroker;

export default {
  AllEventListeners,
  ExtensionEvents,
} as const;
