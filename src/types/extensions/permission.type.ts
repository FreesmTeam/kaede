import type { PERMISSION_CATALOG } from "@/constants/permissions.ts";
import type {
  ExtensionEventListener,
  ExtensionEventSnapshot,
} from "@/lib/extensions-manager/scopes/event-broker.ts";

export type PermissionId = keyof typeof PERMISSION_CATALOG;

export type SimplePermissionId =
  | "ui/basic"
  | "ui/forms/non-credential"
  | "system/shell"
  | "events/subscribe"
  | "logging/write";

export type HttpMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT";

export type NetworkPermissionRequest = Readonly<{
  "id"   : "network/http";
  "scope": Readonly<{
    "origins": ReadonlyArray<string>;
    "methods": ReadonlyArray<HttpMethod>;
  }>;
}>;

export type InternalStoragePermissionRequest = Readonly<{
  "id"   : "storage/internal/read" | "storage/internal/write";
  "scope": Readonly<{
    "directory": "principal";
  }>;
}>;

export type ExternalStoragePermissionRequest = Readonly<{
  "id"   : "storage/external/read" | "storage/external/write";
  "scope": Readonly<{
    "roots": ReadonlyArray<string>;
  }>;
}>;

export type ProcessExecutableScope = Readonly<{
  "path"     : string;
  "arguments": ReadonlyArray<string>;
}>;

export type ProcessPermissionRequest = Readonly<{
  "id"   : "system/process/spawn";
  "scope": Readonly<{
    "executables": ReadonlyArray<ProcessExecutableScope>;
  }>;
}>;

export type ScopedPermissionRequest =
  | NetworkPermissionRequest
  | InternalStoragePermissionRequest
  | ExternalStoragePermissionRequest
  | ProcessPermissionRequest;

export type PermissionRequest = SimplePermissionId | ScopedPermissionRequest;

export type BrokerBytes = ReadonlyArray<number>;
export type BrokerHeaders = ReadonlyArray<Readonly<[string, string]>>;

export type NetworkHttpRequest = Readonly<{
  "url"    : string;
  "method" : HttpMethod;
  "headers": BrokerHeaders;
  "body"?  : string | BrokerBytes;
}>;

export type NetworkHttpResponse = Readonly<{
  "status"    : number;
  "statusText": string;
  "headers"   : BrokerHeaders;
  "body"      : BrokerBytes;
}>;

export interface NetworkHttpCapability {
  readonly "fetch": (request: NetworkHttpRequest) => Promise<NetworkHttpResponse>;
}

export interface InternalStorageReadCapability {
  readonly "read"    : (relativePath: string) => Promise<BrokerBytes>;
  readonly "readText": (relativePath: string) => Promise<string>;
}

export interface InternalStorageWriteCapability {
  readonly "write"    : (relativePath: string, contents: BrokerBytes) => Promise<void>;
  readonly "writeText": (relativePath: string, contents: string) => Promise<void>;
  readonly "remove"   : (relativePath: string) => Promise<void>;
}

export type ExternalStorageTarget = Readonly<{
  "root"        : string;
  "relativePath": string;
}>;

export interface ExternalStorageReadCapability {
  readonly "read"    : (target: ExternalStorageTarget) => Promise<BrokerBytes>;
  readonly "readText": (target: ExternalStorageTarget) => Promise<string>;
}

export interface ExternalStorageWriteCapability {
  readonly "write"    : (target: ExternalStorageTarget, contents: BrokerBytes) => Promise<void>;
  readonly "writeText": (target: ExternalStorageTarget, contents: string) => Promise<void>;
  readonly "remove"   : (target: ExternalStorageTarget) => Promise<void>;
}

export type ProcessSpawnRequest = Readonly<{
  "path"     : string;
  "arguments": ReadonlyArray<string>;
}>;

export type ProcessResult = Readonly<{
  "code"  : number | null;
  "signal": number | null;
  "stdout": BrokerBytes;
  "stderr": BrokerBytes;
}>;

export interface ProcessHandleCapability {
  readonly "handleId": string;
  readonly "pid"     : number;
  readonly "kill"    : () => Promise<void>;
  readonly "wait"    : () => Promise<ProcessResult>;
}

export interface ProcessSpawnCapability {
  readonly "spawn": (request: ProcessSpawnRequest) => Promise<ProcessHandleCapability>;
}

export type ShellExecuteRequest = Readonly<{
  "command": string;
}>;

export interface ShellCapability {
  readonly "execute": (request: ShellExecuteRequest) => Promise<ProcessResult>;
}

export type BrokerEvent = ExtensionEventSnapshot;

export interface EventSubscribeCapability {
  readonly "subscribe": (listener: ExtensionEventListener) => () => void;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggingCapability {
  readonly "write": (
    level: LogLevel,
    message: string,
    details?: ReadonlyArray<string>,
  ) => void;
}

export type PluginCapabilities = Readonly<{
  "ui/basic"               : import("ark-of-atrahasis").SafeDocument;
  "ui/forms/non-credential": never;
  "network/http"           : NetworkHttpCapability;
  "storage/internal/read"  : InternalStorageReadCapability;
  "storage/internal/write" : InternalStorageWriteCapability;
  "storage/external/read"  : ExternalStorageReadCapability;
  "storage/external/write" : ExternalStorageWriteCapability;
  "system/process/spawn"   : ProcessSpawnCapability;
  "system/shell"           : ShellCapability;
  "events/subscribe"       : EventSubscribeCapability;
  "logging/write"          : LoggingCapability;
}>;

export type PermissionGrant = Readonly<{
  "granted"     : ReadonlyArray<PermissionId>;
  "denied"      : ReadonlyArray<PermissionId>;
  "capabilities": Readonly<Partial<PluginCapabilities>>;
}>;

/** @deprecated Use PermissionRequest. */
export type PermissionType = PermissionRequest;
