import {
  createBrowserDecisionStore,
} from "@/lib/browser/scopes/browser-preview-decision-store.ts";
import {
  createBrowserHostFacade,
} from "@/lib/browser/scopes/browser-preview-host.ts";
import {
  createBrowserPluginSession,
  type EventFactoryProvider,
} from "@/lib/browser/scopes/browser-preview-plugin.ts";
import {
  BROWSER_RUNTIME_SNAPSHOT,
  createBrowserDirectHostFacade,
} from "@/lib/browser/scopes/browser-preview-runtime.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import { createBrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import {
  prepareBrowserPermissionRequests,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  CapabilityBrokerRuntime,
  PluginCapabilitySession,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";

export async function createBrowserCapabilityBroker(
  getEventFactory: EventFactoryProvider,
  storage?: BrowserStorage,
): Promise<CapabilityBrokerRuntime> {
  const activeStorage = storage ?? await createBrowserStorage();
  const direct = createBrowserDirectHostFacade();
  const host = createBrowserHostFacade(activeStorage, BROWSER_RUNTIME_SNAPSHOT, direct);

  return Object.freeze({
    host,
    direct,
    "decisionStore"            : createBrowserDecisionStore(activeStorage),
    "preparePermissionRequests": async (
      requests,
    ): Promise<ReadonlyArray<PreparedPermissionRequest>> => {
      return prepareBrowserPermissionRequests(requests);
    },
    "openPluginSession": async (
      principal: PluginPrincipal,
    ): Promise<PluginCapabilitySession> => {
      return createBrowserPluginSession(principal, activeStorage, getEventFactory);
    },
  } satisfies CapabilityBrokerRuntime);
}
