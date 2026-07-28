export type DirectoryEntry = Readonly<{
  "name"       : string;
  "isDirectory": boolean;
  "isFile"     : boolean;
  "isSymlink"  : boolean;
}>;

export type FileMetadata = Readonly<{
  "modifiedTimeMilliseconds": number | null;
}>;

export type SystemMemory = Readonly<{
  "usedBytes" : number;
  "totalBytes": number;
}>;

export type LogStreamEvent =
  | Readonly<{ "type": "snapshot" | "lines"; "data": ReadonlyArray<string> }>
  | Readonly<{ "type": "truncated" }>;

export interface HostLogs {
  write(input: Readonly<{
    "level"   : "debug" | "info" | "warn" | "error";
    "message" : string;
    "location": string;
  }>): void;
  stream(onEvent: (event: LogStreamEvent) => void): Promise<void>;
  stopStream(): Promise<boolean>;
}

export type RuntimeKind = "desktop" | "browser-preview";

export type RuntimeSnapshot = Readonly<{
  "kind"               : RuntimeKind;
  "launchCount"        : number;
  "portable"           : boolean;
  "baseDirectory"      : string;
  "executableDirectory": string;
  "appDataDirectory"   : string;
  "os"                 : Readonly<{
    "platform": string;
    "arch"    : string;
    "version" : string;
  }>;
}>;

export type PickedIcon = Readonly<{ "path": string; "bytes": Uint8Array }>;

export type DownloadProgress = Readonly<{
  "transferred"   : number;
  "total"         : number | null;
  "bytesPerSecond": number;
}>;

export type DownloadBatchEntry = Readonly<{
  "url" : string;
  "path": string;
}>;

export type DownloadBatchInput = Readonly<{
  "entries"    : ReadonlyArray<DownloadBatchEntry>;
  "concurrency": number;
  "label"      : string;
  "cancelId"   : string;
  "debug"     ?: boolean;
}>;

export type DownloadBatchSnapshot = Readonly<{
  "current": Readonly<Record<string, readonly [number, number]>>;
  "success": number;
  "failed" : number;
}>;

export type DownloadFailure = Readonly<{
  "url"  : string;
  "path" : string;
  "error": string;
}>;

export type DownloadReport = Readonly<{
  "success"  : number;
  "failed"   : number;
  "cancelled": boolean;
  "failures" : ReadonlyArray<DownloadFailure>;
}>;

export interface HostDownloads {
  toFile(
    input: Readonly<{ "url": string; "destinationPath": string }>,
    onProgress: (progress: DownloadProgress) => void,
  ): Promise<void>;
  batch(
    input: DownloadBatchInput,
    onProgress: (snapshot: DownloadBatchSnapshot) => void,
  ): Promise<DownloadReport>;
  cancel(cancelId: string): Promise<boolean>;
}

export type HostHttpRequestInit = Readonly<{
  "method" ?: string;
  "headers"?: HeadersInit;
  "body"   ?: BodyInit | null;
}>;

export type InstalledExtensionArchive = Readonly<{
  "fileName"      : string;
  "metadata"      : unknown;
  "code"          : string;
  "artifactSha256": string;
}>;

export type InstalledExtensionFailure = Readonly<{
  "fileName": string;
  "error"   : string;
}>;

export type InstalledExtensionsReadResult = Readonly<{
  "extensions": ReadonlyArray<InstalledExtensionArchive>;
  "failures"  : ReadonlyArray<InstalledExtensionFailure>;
}>;
