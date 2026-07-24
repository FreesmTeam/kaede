import { vi } from "vitest";

import { GlobalObject } from "@/extendable/global-object.ts";
import { DirectHost, Host } from "@/lib/capability-broker";
import {
  prepareIdentityFreePermissionRequests,
} from "@/lib/capability-broker/permission-preparation.ts";
import type {
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import {
  createTrustedExtensionContext,
  ExtensionLifecycleController,
  type ExtensionLifecycleDependencies,
  type LifecyclePluginSession,
} from "@/lib/extensions-manager/scopes/extension-lifecycle.ts";
import { planPlugins } from "@/lib/extensions-manager/scopes/plugin-planner.ts";
import type {
  SandboxRuntimeHandle,
  SandboxRuntimeOptions,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type {
  LoggingCapability,
  PermissionGrant,
} from "@/types/extensions/permission.type.ts";

const ARTIFACT_HASH = "a".repeat(64);
const MAX_BOUNDS = Object.freeze({ "inlineSizePx": 960, "blockSizePx": 540 });
const TRUSTED_CONTAINER = Object.create(null) as HTMLElement;

export function artifact(
  id: string,
  code = `void ${JSON.stringify(id)}`,
): ExtensionInfoType {
  return { id, code, "artifactSha256": ARTIFACT_HASH };
}

export function metadata(
  id: string,
  overrides: Partial<ExtensionMetadataType> = {},
): ExtensionMetadataType {
  return {
    id,
    "logo"      : "plugin.svg",
    "name"      : id,
    "type"      : "sandbox",
    "source"    : "https://example.test/plugins",
    "version"   : "1.0.0",
    "authors"   : ["Kaede"],
    "languages" : ["en"],
    "categories": ["utility"],
    "enabled"   : true,
    ...overrides,
  };
}

function emptyGrant(): PermissionGrant {
  return Object.freeze({
    "granted"     : Object.freeze([]),
    "denied"      : Object.freeze([]),
    "capabilities": Object.freeze({}),
  });
}

export function createSession(order?: Array<string>): Readonly<{
  "session" : LifecyclePluginSession;
  "grant"   : ReturnType<typeof vi.fn>;
  "grantAll": ReturnType<typeof vi.fn>;
  "revoke"  : ReturnType<typeof vi.fn>;
}> {
  const loggingCapability = Object.freeze({
    "write": vi.fn(),
  }) satisfies LoggingCapability;
  const grant = vi.fn(async (): Promise<void> => {
    order?.push("grant-dynamic");
  });
  const grantAll = vi.fn(async (): Promise<void> => {
    order?.push("grant-static");
  });
  const revoke = vi.fn(async (): Promise<void> => {
    order?.push("revoke");
  });

  return Object.freeze({
    grant,
    grantAll,
    revoke,
    "session": Object.freeze({
      "capabilityFactories": Object.freeze({
        "logging/write": () => loggingCapability,
      }),
      grant,
      grantAll,
      revoke,
    }),
  });
}

export function createRuntimeFactory(order?: Array<string>): Readonly<{
  "create"  : (options: SandboxRuntimeOptions) => Promise<SandboxRuntimeHandle>;
  "disposes": Array<ReturnType<typeof vi.fn>>;
}> {
  const disposes: Array<ReturnType<typeof vi.fn>> = [];
  const create = vi.fn(async (options: SandboxRuntimeOptions): Promise<SandboxRuntimeHandle> => {
    const dispose = vi.fn((): void => {
      order?.push("dispose");
    });

    disposes.push(dispose);

    return Object.freeze({
      "capabilities"      : Object.freeze({}),
      "staticGrant"       : emptyGrant(),
      "requestPermissions": options.requestPermissions,
      dispose,
    });
  });

  return Object.freeze({ create, disposes });
}

export function createDependencies({
  artifacts = [artifact("plugin")],
  metadataEntries = [metadata("plugin")],
  requestStatic = async (): Promise<boolean> => true,
  requestDynamic = async (): Promise<ReadonlyArray<boolean>> => [],
  preparePermissions = async (
    requests,
  ): Promise<ReadonlyArray<PreparedPermissionRequest>> => {
    return prepareIdentityFreePermissionRequests(requests, false);
  },
  runSandbox = (): void => {},
  runTrusted = async (): Promise<void> => {},
  session = createSession().session,
  runtimeFactory = createRuntimeFactory().create,
  revokeEventsCallback = (): void => {},
}: Readonly<{
  "artifacts"?           : ReadonlyArray<ExtensionInfoType>;
  "metadataEntries"?     : ReadonlyArray<ExtensionMetadataType>;
  "requestStatic"?       : ExtensionLifecycleDependencies["requestStaticPermissions"];
  "requestDynamic"?      : ExtensionLifecycleDependencies["requestDynamicPermissions"];
  "preparePermissions"?  : ExtensionLifecycleDependencies["preparePermissionRequests"];
  "runSandbox"?          : ExtensionLifecycleDependencies["runInSandbox"];
  "runTrusted"?          : ExtensionLifecycleDependencies["runInUnrestricted"];
  "session"?             : LifecyclePluginSession;
  "runtimeFactory"?      : ExtensionLifecycleDependencies["createSandboxRuntime"];
  "revokeEventsCallback"?: ExtensionLifecycleDependencies["revokeEventListeners"];
}> = {}): Readonly<{
  "dependencies"   : ExtensionLifecycleDependencies;
  "cancel"         : ReturnType<typeof vi.fn>;
  "configure"      : ReturnType<typeof vi.fn>;
  "configureEvents": ReturnType<typeof vi.fn>;
  "lockdown"       : ReturnType<typeof vi.fn>;
  "open"           : ReturnType<typeof vi.fn>;
  "reportError"    : ReturnType<typeof vi.fn>;
  "revokeEvents"   : ReturnType<typeof vi.fn>;
  "revokeGlobals"  : ReturnType<typeof vi.fn>;
}> {
  const cancel = vi.fn();
  const configure = vi.fn();
  const configureEvents = vi.fn();
  const lockdown = vi.fn();
  const open = vi.fn(async (): Promise<LifecyclePluginSession> => session);
  const reportError = vi.fn();
  const revokeEvents = vi.fn(revokeEventsCallback);
  const revokeGlobals = vi.fn();
  const dependencies = {
    "readAllExtensions": async (): Promise<ReadonlyArray<ExtensionInfoType>> => artifacts,
    "readAllMetadata"  : async (): Promise<ReadonlyArray<ExtensionMetadataType>> => {
      return metadataEntries;
    },
    planPlugins,
    "configurePermissionDecisions": configure,
    "configureEventCapabilities"  : configureEvents,
    "trustedContext"              : createTrustedExtensionContext({
      Host,
      DirectHost,
      "Kaede": GlobalObject,
    }),
    "runInUnrestricted"        : runTrusted,
    "revokeExtensionGlobals"   : revokeGlobals,
    "lockdownEnvironment"      : lockdown,
    "preparePermissionRequests": preparePermissions,
    "requestStaticPermissions" : requestStatic,
    "requestDynamicPermissions": requestDynamic,
    "cancelPermissionPrompts"  : cancel,
    "openPluginSession"        : open,
    "createSandboxRuntime"     : runtimeFactory,
    "runInSandbox"             : runSandbox,
    "revokeEventListeners"     : revokeEvents,
    reportError,
  } satisfies ExtensionLifecycleDependencies;

  return Object.freeze({
    dependencies,
    cancel,
    configure,
    configureEvents,
    lockdown,
    open,
    reportError,
    revokeEvents,
    revokeGlobals,
  });
}

export async function initialize(controller: ExtensionLifecycleController): Promise<void> {
  await controller.initialize({
    "trustedContainer": TRUSTED_CONTAINER,
    "maxBounds"       : MAX_BOUNDS,
    "onCatalog"       : (): void => {},
  });
}
