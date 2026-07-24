import type {
  DirectoryEntry,
  FileMetadata,
  HostDownloads,
  HostHttpRequestInit,
  InstalledExtensionsReadResult,
  PickedIcon,
  RuntimeSnapshot,
  SystemMemory,
} from "@/lib/capability-broker/host-types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type * as InitialState from "@/types/application/initial-state.type.ts";
import type {
  EventSubscribeCapability,
  ExternalStorageReadCapability,
  ExternalStorageWriteCapability,
  InternalStorageReadCapability,
  InternalStorageWriteCapability,
  LoggingCapability,
  NetworkHttpCapability,
  PermissionRequest,
  ProcessSpawnCapability,
  ShellCapability,
} from "@/types/extensions/permission.type.ts";

export type {
  DirectoryEntry,
  DownloadBatchEntry,
  DownloadBatchInput,
  DownloadBatchSnapshot,
  DownloadFailure,
  DownloadProgress,
  DownloadReport,
  FileMetadata,
  HostDownloads,
  HostHttpRequestInit,
  InstalledExtensionArchive,
  InstalledExtensionFailure,
  InstalledExtensionsReadResult,
  PickedIcon,
  RuntimeKind,
  RuntimeSnapshot,
  SystemMemory,
} from "@/lib/capability-broker/host-types.ts";

export type PermissionTargetKind = "external_storage_root" | "process_executable";

export type DesktopStorageTargetIdentity = Readonly<{
  "kind"            : "external_storage_root";
  "path"            : string;
  "identityProvider": "desktop-filesystem-v1";
  "device"          : string;
  "inode"           : string;
}>;

export type DesktopProcessExecutableTargetIdentity = Readonly<{
  "kind"            : "process_executable";
  "path"            : string;
  "identityProvider": "desktop-executable-sha256-v1";
  "device"          : string;
  "inode"           : string;
  "contentSha256"   : string;
}>;

export type DesktopFilesystemTargetIdentity =
  | DesktopProcessExecutableTargetIdentity
  | DesktopStorageTargetIdentity;

export type BrowserPreviewTargetIdentity = Readonly<{
  "kind"            : PermissionTargetKind;
  "path"            : string;
  "identityProvider": "browser-preview-logical-v1" | "browser-preview-unsupported-v1";
}>;

export type PermissionTargetIdentity =
  | BrowserPreviewTargetIdentity
  | DesktopFilesystemTargetIdentity;

/**
 * Host-only permission material. Plugins receive neither target identities nor broker sessions.
 * The descriptor contains the exact path shown to the user; targetIdentities bind remembered
 * decisions and the later Rust grant to the filesystem objects confirmed before the prompt.
 */
export type PreparedPermissionRequest = Readonly<{
  "descriptor"      : PermissionRequest;
  "targetIdentities": ReadonlyArray<PermissionTargetIdentity>;
}>;

export type Brand<Value, Name extends string> = Value & {
  readonly "__brand": Name;
};

export type ProcessHandle = Brand<string, "ProcessHandle">;

export type BrokerProcess = Readonly<{
  "handle": ProcessHandle;
  "pid"   : number;
}>;

export type BrokerServerProcess = BrokerProcess & Readonly<{ "port": number }>;

export type ProcessEvent =
  | Readonly<{ "kind": "stdout"; "handle": ProcessHandle; "bytes": Uint8Array }>
  | Readonly<{ "kind": "stderr"; "handle": ProcessHandle; "bytes": Uint8Array }>
  | Readonly<{
    "kind"  : "terminated";
    "handle": ProcessHandle;
    "code"  : number | null;
    "signal": number | null;
  }>
  | Readonly<{
    "kind"   : "error";
    "handle" : ProcessHandle;
    "message": string;
  }>
  | Readonly<{
    "kind"   : "failed";
    "handle" : ProcessHandle;
    "message": string;
  }>;

export interface DirectHostFacade {
  readonly "app": Readonly<{
    name(): Promise<string>;
    version(): Promise<string>;
    tauriVersion(): Promise<string>;
  }>;
  readonly "path": Readonly<{
    join(...parts: ReadonlyArray<string>): Promise<string>;
    normalize(path: string): Promise<string>;
  }>;
  showMainWebview(): Promise<void>;
}

export interface HostFacade {
  readonly "diagnostics": Readonly<{
    getSystemMemory(): Promise<SystemMemory>;
    getGlobalCpuUsage(): Promise<number>;
  }>;
  readonly "runtime": Readonly<{
    getSnapshot(): Promise<RuntimeSnapshot>;
    getCachedSnapshot(): RuntimeSnapshot;
    getInitialState(): Promise<InitialState.InitialStateType>;
    finalizeInitialization(
      input: InitialState.InitializationFinalizationInput,
    ): Promise<InitialState.InitializationFinalizationReport>;
  }>;
  readonly "files": Readonly<{
    exists(path: string): Promise<boolean>;
    existsMany(paths: ReadonlyArray<string>): Promise<ReadonlyArray<boolean>>;
    getMetadata(path: string): Promise<FileMetadata>;
    findMissing(paths: ReadonlyArray<string>): Promise<ReadonlyArray<string>>;
    verifySha1(
      artifacts: ReadonlyArray<Readonly<{ "path": string; "hash": string }>>,
    ): Promise<ReadonlyArray<string>>;
    readDirectory(path: string): Promise<ReadonlyArray<DirectoryEntry>>;
    readText(path: string): Promise<string>;
    readBytes(path: string): Promise<Uint8Array>;
    writeText(path: string, contents: string): Promise<void>;
    rename(input: Readonly<{ "from": string; "to": string }>): Promise<void>;
    ensureDirectories(
      paths: ReadonlyArray<string>,
      options?: Readonly<{ "recursive"?: boolean }>,
    ): Promise<void>;
  }>;
  readonly "assets": Readonly<{
    pickAndCopyInstanceIcon(input: Readonly<{
      "destinationDirectory": string;
      "allowedExtensions"   : ReadonlyArray<string>;
      "title"              ?: string;
    }>): Promise<PickedIcon | null>;
  }>;
  readonly "archives": Readonly<{
    extractZip(input: Readonly<{
      "archivePath"    : string;
      "destinationPath": string;
    }>): Promise<void>;
  }>;
  readonly "extensions": Readonly<{
    readInstalledArchives(): Promise<InstalledExtensionsReadResult>;
  }>;
  readonly "http": Readonly<{
    fetch(input: string | URL, init?: HostHttpRequestInit): Promise<Response>;
  }>;
  readonly "downloads": Readonly<HostDownloads>;
  readonly "dialogs": Readonly<{
    message(input: Readonly<{
      "message": string;
      "title"  : string;
      "kind"   : "info" | "warning" | "error";
    }>): Promise<void>;
    ask(input: Readonly<{
      "message": string;
      "title"  : string;
      "kind"   : "info" | "warning" | "error";
    }>): Promise<boolean>;
  }>;
  readonly "opener": Readonly<{
    revealItem(path: string): Promise<void>;
  }>;
  readonly "processes": Readonly<{
    probeJavaMajor(): Promise<number>;
    launchMinecraft(
      input: Readonly<{
        "executable": string;
        "arguments" : ReadonlyArray<string>;
        "cwd"       : string;
        "instanceId": string;
      }>,
      onEvent: (event: ProcessEvent) => void,
    ): Promise<BrokerProcess>;
    kill(handle: ProcessHandle): Promise<void>;
  }>;
  readonly "servers": Readonly<{
    serveCode(
      input: Readonly<{ "name": string; "code": string }>,
      onEvent: (event: ProcessEvent) => void,
    ): Promise<BrokerServerProcess>;
    serveFile(
      input: Readonly<{ "name": string; "filePath": string }>,
      onEvent: (event: ProcessEvent) => void,
    ): Promise<BrokerServerProcess>;
  }>;
  readonly "logs": Readonly<{
    write(input: Readonly<{
      "level"   : "debug" | "info" | "warn" | "error";
      "message" : string;
      "location": string;
    }>): void;
  }>;
}

export type PluginCapabilityFactories = Readonly<{
  "network/http"          : () => NetworkHttpCapability;
  "storage/internal/read" : () => InternalStorageReadCapability;
  "storage/internal/write": () => InternalStorageWriteCapability;
  "storage/external/read" : () => ExternalStorageReadCapability;
  "storage/external/write": () => ExternalStorageWriteCapability;
  "system/process/spawn"  : () => ProcessSpawnCapability;
  "system/shell"          : () => ShellCapability;
  "events/subscribe"      : () => EventSubscribeCapability;
  "logging/write"         : () => LoggingCapability;
}>;

export interface PluginCapabilitySession {
  readonly "principal"          : PluginPrincipal;
  readonly "capabilityFactories": PluginCapabilityFactories;
  grant(descriptor: PreparedPermissionRequest): Promise<void>;
  grantAll(descriptors: ReadonlyArray<PreparedPermissionRequest>): Promise<void>;
  revoke(): Promise<Readonly<{ "alreadyRevoked": boolean }>>;
}

export type PluginEventCapabilityFactory = (
  principal: PluginPrincipal,
) => EventSubscribeCapability;

export type PermissionDecisionStoreKey = Readonly<{
  "kind"              : "dynamic" | "static";
  "principalKey"      : string;
  "requestFingerprint": string;
}>;

export interface BrokerDecisionStore {
  load(key: PermissionDecisionStoreKey): Promise<boolean | undefined>;
  save(key: PermissionDecisionStoreKey, decision: boolean): Promise<void>;
}

export type CapabilityBrokerRuntime = Readonly<{
  "host"                     : HostFacade;
  "direct"                   : DirectHostFacade;
  "decisionStore"            : BrokerDecisionStore;
  "preparePermissionRequests": (
    requests: ReadonlyArray<PermissionRequest>,
  ) => Promise<ReadonlyArray<PreparedPermissionRequest>>;
  "openPluginSession": (principal: PluginPrincipal) => Promise<PluginCapabilitySession>;
}>;
