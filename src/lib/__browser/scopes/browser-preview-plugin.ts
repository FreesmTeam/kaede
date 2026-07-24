import {
  type BrowserGrantGuard,
  type BrowserGrantStore,
  storeBrowserGrant,
  storeBrowserGrants,
} from "@/lib/browser/scopes/browser-preview-grants.ts";
import { logInBrowser } from "@/lib/browser/scopes/browser-preview-io.ts";
import { fetchWithNetworkGrants } from "@/lib/browser/scopes/browser-preview-network.ts";
import {
  createBrowserPluginStorageFactories,
} from "@/lib/browser/scopes/browser-preview-plugin-storage.ts";
import {
  type BrowserSessionOperationRunner,
  createBrowserSessionOperationBarrier,
} from "@/lib/browser/scopes/browser-preview-session-operations.ts";
import type { BrowserStorage } from "@/lib/browser/scopes/browser-storage.ts";
import { UnsupportedInBrowserPreviewError } from "@/lib/capability-broker/errors.ts";
import type {
  PluginCapabilityFactories,
  PluginCapabilitySession,
  PluginEventCapabilityFactory,
} from "@/lib/capability-broker/types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  EventSubscribeCapability,
  LoggingCapability,
  LogLevel,
  NetworkHttpCapability,
  NetworkHttpRequest,
  NetworkHttpResponse,
  ProcessResult,
  ProcessSpawnCapability,
  ShellCapability,
} from "@/types/extensions/permission.type.ts";

export type EventFactoryProvider = () => PluginEventCapabilityFactory | undefined;

function browserProcessError(capability: string): Promise<ProcessResult> {
  return Promise.reject(new UnsupportedInBrowserPreviewError(capability));
}

function createBrowserPluginRuntimeFactories(
  principal: PluginPrincipal,
  requireGrant: BrowserGrantGuard,
  runOperation: BrowserSessionOperationRunner,
  getEventFactory: EventFactoryProvider,
): Pick<
  PluginCapabilityFactories,
  "network/http" | "system/process/spawn" | "system/shell" | "events/subscribe" | "logging/write"
> {
  return Object.freeze({
    "network/http": (): NetworkHttpCapability => Object.freeze({
      "fetch": (request: NetworkHttpRequest): Promise<NetworkHttpResponse> => {
        return runOperation(() => fetchWithNetworkGrants(request, requireGrant));
      },
    }),
    "system/process/spawn": (): ProcessSpawnCapability => Object.freeze({
      "spawn": (): Promise<never> => {
        return runOperation(async () => {
          requireGrant("system/process/spawn");
          throw new UnsupportedInBrowserPreviewError("plugin process launch");
        });
      },
    }),
    "system/shell": (): ShellCapability => Object.freeze({
      "execute": (): Promise<ProcessResult> => {
        return runOperation(() => {
          requireGrant("system/shell");

          return browserProcessError("plugin shell execution");
        });
      },
    }),
    "events/subscribe": (): EventSubscribeCapability => {
      requireGrant("events/subscribe");
      const factory = getEventFactory();

      if (factory === undefined) {
        throw new Error(
          "No principal-specific frontend event capability factory is configured",
        );
      }

      const capability = factory(principal);

      requireGrant("events/subscribe");

      return Object.freeze({
        "subscribe": (
          listener: Parameters<EventSubscribeCapability["subscribe"]>[0],
        ) => {
          requireGrant("events/subscribe");

          return capability.subscribe(listener);
        },
      });
    },
    "logging/write": (): LoggingCapability => Object.freeze({
      "write": (
        level: LogLevel,
        message: string,
        details?: ReadonlyArray<string>,
      ): void => {
        requireGrant("logging/write");
        logInBrowser(level, [message, ...(details ?? [])].join(" "), principal.pluginId);
      },
    }),
  });
}

export function createBrowserPluginSession(
  principal: PluginPrincipal,
  storage: BrowserStorage,
  getEventFactory: EventFactoryProvider,
): PluginCapabilitySession {
  const grants: BrowserGrantStore = new Map;
  const operationBarrier = createBrowserSessionOperationBarrier(
    principal.pluginId,
    () => grants.clear(),
  );
  const requireNotRevoked = operationBarrier.requireActive;
  const requireGrant: BrowserGrantGuard = id => {
    requireNotRevoked();
    const grant = grants.get(id);

    if (grant === undefined) {
      throw new Error(`Plugin capability has not been granted: ${id}`);
    }

    return grant;
  };
  const capabilityFactories: PluginCapabilityFactories = Object.freeze({
    ...createBrowserPluginStorageFactories(
      principal,
      storage,
      requireGrant,
      operationBarrier.run,
    ),
    ...createBrowserPluginRuntimeFactories(
      principal,
      requireGrant,
      operationBarrier.run,
      getEventFactory,
    ),
  });

  return Object.freeze({
    principal,
    capabilityFactories,
    "grant": async (
      prepared: Parameters<PluginCapabilitySession["grant"]>[0],
    ): Promise<void> => {
      requireNotRevoked();
      storeBrowserGrant(grants, prepared.descriptor);
    },
    "grantAll": async (
      descriptors: Parameters<PluginCapabilitySession["grantAll"]>[0],
    ): Promise<void> => {
      requireNotRevoked();
      storeBrowserGrants(grants, descriptors.map(prepared => prepared.descriptor));
    },
    "revoke": async (): ReturnType<PluginCapabilitySession["revoke"]> => {
      return operationBarrier.revoke();
    },
  });
}
