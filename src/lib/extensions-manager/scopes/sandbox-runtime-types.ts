import type {
  PermissionGrant,
  PermissionId,
  PermissionRequest,
  PluginCapabilities,
} from "@/types/extensions/permission.type.ts";

export type ArkRuntimeModule = Readonly<{
  "createSafeDocument"   : typeof import("ark-of-atrahasis")["createSafeDocument"];
  "SAFE_STYLE_PROPERTIES": ReadonlyArray<import("ark-of-atrahasis").SafeStyleProperty>;
  "URL_SINKS"            : ReadonlyArray<import("ark-of-atrahasis").URLSink>;
}>;

export type NonDOMPermissionId = Exclude<
  PermissionId,
  "ui/basic" | "ui/forms/non-credential"
>;

export type PermissionRequestFor<Id extends PermissionId> = Extract<
  PermissionRequest,
  Id | Readonly<{ "id": Id }>
>;

/** Factories must return broker wrappers, never raw host handles, invokes, or tokens. */
export type StaticCapabilityFactory<Id extends NonDOMPermissionId> = (
  permission: PermissionRequestFor<Id>,
) => PluginCapabilities[Id];

export type StaticCapabilityFactories = Readonly<{
  [Id in NonDOMPermissionId]?: StaticCapabilityFactory<Id>;
}>;

export type SandboxMaxBounds = Readonly<{
  "inlineSizePx": number;
  "blockSizePx" : number;
}>;

export type SandboxHostBoundary = Readonly<{
  "root"  : ShadowRoot;
  "remove": () => void;
}>;

export type SandboxRuntimeDependencies = Readonly<{
  "assertLockdown"    : () => void;
  "loadArk"           : () => Promise<ArkRuntimeModule>;
  "harden"            : import("ark-of-atrahasis").Hardener;
  "createHostBoundary": (
    trustedContainer: HTMLElement,
    maxBounds: SandboxMaxBounds,
  ) => SandboxHostBoundary;
}>;

export type SandboxRuntimeOptions = Readonly<{
  "trustedContainer"  : HTMLElement;
  "maxBounds"         : SandboxMaxBounds;
  "staticPermissions" : ReadonlyArray<PermissionRequest>;
  "requestPermissions"           : (
    permissions: ReadonlyArray<PermissionRequest>,
  ) => Promise<PermissionGrant>;
  "nonDOMCapabilityFactories"?: StaticCapabilityFactories;
  "disposeEvents"?            : () => void;
  "dependencies"?             : Partial<SandboxRuntimeDependencies>;
}>;

export type SandboxRuntimeHandle = Readonly<{
  "capabilities"      : Readonly<Partial<PluginCapabilities>>;
  "staticGrant"       : PermissionGrant;
  "requestPermissions": (
    permissions: ReadonlyArray<PermissionRequest>,
  ) => Promise<PermissionGrant>;
  "dispose": () => void;
}>;
