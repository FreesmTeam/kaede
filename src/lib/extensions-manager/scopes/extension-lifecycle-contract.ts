import type { KaedeNamespaceType } from "@/declarations.ts";
import type {
  DirectHostFacade,
  HostFacade,
  PreparedPermissionRequest,
} from "@/lib/capability-broker";
import type {
  PluginExecutionPlan,
  PluginPlannerOptions,
} from "@/lib/extensions-manager/scopes/plugin-planner.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  RunInUnrestrictedOptions,
  TrustedExtensionContext,
} from "@/lib/extensions-manager/scopes/run-in-unrestricted.ts";
import type {
  SandboxMaxBounds,
  SandboxRuntimeHandle,
  SandboxRuntimeOptions,
} from "@/lib/extensions-manager/scopes/sandbox-runtime.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type {
  PermissionGrant,
  PermissionId,
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

type MaybePromise<Value> = Promise<Value> | Value;
type LifecycleNonDOMPermissionId = Exclude<
  PermissionId,
  "ui/basic" | "ui/forms/non-credential"
>;

export type LifecycleCapabilityFactories = Readonly<Partial<{
  [Id in LifecycleNonDOMPermissionId]: () => PluginCapabilities[Id];
}>>;

export type LifecyclePluginSession = Readonly<{
  "capabilityFactories": LifecycleCapabilityFactories;
  "grant"              : (descriptor: PreparedPermissionRequest) => Promise<void>;
  "grantAll"           : (descriptors: ReadonlyArray<PreparedPermissionRequest>) => Promise<void>;
  "revoke"             : () => Promise<unknown>;
}>;

export type ExtensionCatalog = Readonly<{
  "metadata"         : ReadonlyArray<ExtensionMetadataType>;
  "unknownExtensions": ReadonlyArray<ExtensionInfoType>;
}>;

export type ExtensionLifecycleDependencies = Readonly<{
  "readAllExtensions"           : () => Promise<ReadonlyArray<ExtensionInfoType>>;
  "readAllMetadata"             : () => Promise<ReadonlyArray<ExtensionMetadataType>>;
  "planPlugins"                 : (options: PluginPlannerOptions) => PluginExecutionPlan;
  "configurePermissionDecisions": () => void;
  "configureEventCapabilities"  : () => void;
  "trustedContext"              : TrustedExtensionContext;
  "runInUnrestricted"           : (options: RunInUnrestrictedOptions) => Promise<void>;
  "revokeExtensionGlobals"      : () => void;
  "lockdownEnvironment"         : () => void;
  "preparePermissionRequests": (
    requests: ReadonlyArray<PermissionRequest>,
  ) => Promise<ReadonlyArray<PreparedPermissionRequest>>;
  "requestStaticPermissions": (
    principal: PluginPrincipal,
    requests: ReadonlyArray<PreparedPermissionRequest>,
  ) => Promise<boolean>;
  "requestDynamicPermissions": (
    principal: PluginPrincipal,
    requests: ReadonlyArray<PreparedPermissionRequest>,
  ) => Promise<ReadonlyArray<boolean>>;
  "cancelPermissionPrompts": (principal: PluginPrincipal) => void;
  "openPluginSession"      : (principal: PluginPrincipal) => Promise<LifecyclePluginSession>;
  "createSandboxRuntime"   : (
    options: SandboxRuntimeOptions,
  ) => Promise<SandboxRuntimeHandle>;
  "runInSandbox": (options: Readonly<{
    "code"              : string;
    "scopedThis"        : Readonly<Partial<PluginCapabilities>>;
    "requestPermissions": (
      permissions: ReadonlyArray<PermissionRequest>,
    ) => Promise<PermissionGrant>;
  }>) => MaybePromise<unknown>;
  "revokeEventListeners": (principalKey: string) => void;
  "reportError"         : (context: string, error: unknown) => void;
}>;

export type ExtensionLifecycleInitializeOptions = Readonly<{
  "trustedContainer": HTMLElement;
  "maxBounds"       : SandboxMaxBounds;
  "onCatalog"       : (catalog: ExtensionCatalog) => void;
}>;

export function createTrustedExtensionContext({
  Host,
  DirectHost,
  Kaede,
}: Readonly<{
  "Host"      : HostFacade;
  "DirectHost": DirectHostFacade;
  "Kaede"     : KaedeNamespaceType;
}>): TrustedExtensionContext {
  return Object.freeze({ Host, DirectHost, Kaede });
}
