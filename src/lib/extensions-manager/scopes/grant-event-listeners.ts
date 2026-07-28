import { ExtensionEvents } from "@/constants/event-listeners.ts";
import type { ExtensionEventListener } from "@/lib/extensions-manager/scopes/event-broker.ts";
import {
  createPluginPrincipalKey,
  type PluginPrincipal,
  type PluginPrincipalKey,
} from "@/lib/extensions-manager/scopes/principal.ts";
import type { EventSubscribeCapability } from "@/types/extensions/permission.type.ts";

const CapabilityRevocations = new Map<PluginPrincipalKey, Set<() => void>>;

export function createEventSubscribeCapability(
  principal: PluginPrincipal,
): EventSubscribeCapability {
  const principalKey = createPluginPrincipalKey(principal);
  const revocations = CapabilityRevocations.get(principalKey) ?? new Set<() => void>;
  let isActive = true;

  revocations.add((): void => {
    isActive = false;
  });
  CapabilityRevocations.set(principalKey, revocations);

  return Object.freeze({
    "subscribe": (listener: ExtensionEventListener) => {
      if (!isActive) {
        throw new TypeError("Event subscription capability has been revoked");
      }

      return ExtensionEvents.subscribe(principalKey, listener);
    },
  });
}

export function revokeEventListeners(principalKey: PluginPrincipalKey): void {
  ExtensionEvents.unsubscribePrincipal(principalKey);

  const revocations = CapabilityRevocations.get(principalKey);

  CapabilityRevocations.delete(principalKey);

  const activeRevocations = revocations ?? [];

  for (const revoke of activeRevocations) {
    revoke();
  }
}
