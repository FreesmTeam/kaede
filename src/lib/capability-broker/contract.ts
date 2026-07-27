import type * as DownloadContract from "@/lib/capability-broker/download-contract.ts";
import type {
  InstalledExtensionsReadResult,
  PreparedPermissionRequest,
} from "@/lib/capability-broker/types.ts";
import type * as InitialState from "@/types/application/initial-state.type.ts";
import type { HttpMethod, PermissionRequest } from "@/types/extensions/permission.type.ts";

export type SessionToken = string;
export type ResourceHandle = string;

export type BrokerHttpRequest = Readonly<{
  "url"    : string;
  "method" : HttpMethod;
  "headers": ReadonlyArray<Readonly<{ "name": string; "value": string }>>;
  "body"   : ReadonlyArray<number> | null;
}>;

export type BrokerProcessSpec = Readonly<{
  "executable" : string;
  "arguments"  : ReadonlyArray<string>;
  "cwd"        : string | null;
  "environment": Readonly<Record<string, string>>;
}>;

export type BrokerRequest =
  | Readonly<{ "kind": "open_plugin"; "principal": Readonly<{
    "repositoryOrigin": string;
    "pluginId"        : string;
    "version"         : string;
    "artifactSha256"  : string;
  }>; }>
  | Readonly<{
    "kind"       : "prepare_permission_requests";
    "descriptors": ReadonlyArray<PermissionRequest>;
  }>
  | Readonly<{
    "kind"         : "grant_plugin";
    "pluginSession": SessionToken;
    "prepared"     : PreparedPermissionRequest;
  }>
  | Readonly<{ "kind": "revoke_plugin"; "pluginSession": SessionToken }>
  | Readonly<{
    "kind"              : "decision_load";
    "decisionKind"      : "dynamic" | "static";
    "principalKey"      : string;
    "requestFingerprint": string;
  }>
  | Readonly<{
    "kind"              : "decision_save";
    "decisionKind"      : "dynamic" | "static";
    "principalKey"      : string;
    "requestFingerprint": string;
    "decision"          : boolean;
  }>
  | Readonly<{ "kind": "host_runtime_snapshot" }>
  | Readonly<{ "kind": "host_system_memory" }>
  | Readonly<{ "kind": "host_global_cpu_usage" }>
  | Readonly<{ "kind": "host_hash_md5"; "bytes": ReadonlyArray<number> }>
  | Readonly<{ "kind": "host_hash_sha256"; "bytes": ReadonlyArray<number> }>
  | Readonly<{ "kind": "host_read_extensions" }>
  | Readonly<{ "kind": "host_initial_state" }>
  | Readonly<{
    "kind"         : "host_finalize_initialization";
    "baseDirectory": string;
    "folders"      : ReadonlyArray<string>;
    "javaBinary"   : string;
  }>
  | Readonly<{ "kind": "host_fs_exists"; "path": string; "baseDirectory": null }>
  | Readonly<{ "kind": "host_fs_metadata"; "path": string; "baseDirectory": null }>
  | Readonly<{
    "kind"         : "host_fs_exists_many";
    "paths"        : ReadonlyArray<string>;
    "baseDirectory": null;
  }>
  | Readonly<{ "kind": "host_fs_read_text"; "path": string; "baseDirectory": null }>
  | Readonly<{ "kind": "host_fs_read_bytes"; "path": string; "baseDirectory": null }>
  | Readonly<{
    "kind"         : "host_fs_write_text";
    "path"         : string;
    "contents"     : string;
    "baseDirectory": null;
  }>
  | Readonly<{ "kind": "host_fs_read_dir"; "path": string; "baseDirectory": null }>
  | Readonly<{
    "kind"         : "host_fs_ensure_directories";
    "paths"        : ReadonlyArray<string>;
    "baseDirectory": null;
    "recursive"    : boolean;
  }>
  | Readonly<{
    "kind"         : "host_fs_rename";
    "source"       : string;
    "destination"  : string;
    "baseDirectory": null;
  }>
  | Readonly<{
    "kind"                : "host_pick_and_copy_icon";
    "destinationDirectory": string;
    "allowedExtensions"   : ReadonlyArray<string>;
    "title"               : string | null;
  }>
  | Readonly<{ "kind": "missing_paths"; "paths": ReadonlyArray<string> }>
  | Readonly<{
    "kind"     : "verify_sha1";
    "artifacts": ReadonlyArray<Readonly<{ "path": string; "hash": string }>>;
  }>
  | Readonly<{ "kind": "unzip"; "archive": string; "targetDirectory": string }>
  | Readonly<{ "kind": "host_http_fetch"; "request": BrokerHttpRequest }>
  | Readonly<{
    "kind"         : "host_http_download";
    "request"      : BrokerHttpRequest;
    "destination"  : string;
    "baseDirectory": null;
  }>
  | DownloadContract.HostDownloadBatchRequest
  | DownloadContract.HostCancelDownloadsRequest
  | Readonly<{ "kind": "host_probe_java_major" }>
  | Readonly<{
    "kind"      : "host_launch_minecraft";
    "executable": string;
    "arguments" : ReadonlyArray<string>;
    "cwd"       : string;
    "instanceId": string;
  }>
  | Readonly<{ "kind": "host_serve_file"; "name": string; "filePath": string }>
  | Readonly<{ "kind": "host_serve_code"; "name": string; "code": string }>
  | Readonly<{
    "kind"    : "log";
    "level"   : "debug" | "info" | "warn" | "error";
    "message" : string;
    "location": string | null;
  }>
  | Readonly<{
    "kind"      : "dialog_ask" | "dialog_message";
    "title"     : string;
    "message"   : string;
    "dialogKind": "info" | "warning" | "error";
  }>
  | Readonly<{ "kind": "opener_reveal"; "path": string }>
  | Readonly<{ "kind": "plugin_fs_read_text"; "path": string; "baseDirectory": null }>
  | Readonly<{ "kind": "plugin_fs_read_bytes"; "path": string; "baseDirectory": null }>
  | Readonly<{
    "kind"         : "plugin_fs_write_text";
    "path"         : string;
    "contents"     : string;
    "baseDirectory": null;
  }>
  | Readonly<{ "kind": "plugin_fs_write_bytes"; "path": string; "bytes": number[] }>
  | Readonly<{ "kind": "plugin_fs_remove"; "path": string }>
  | Readonly<{ "kind": "plugin_http_fetch"; "request": BrokerHttpRequest }>
  | Readonly<{ "kind": "plugin_process_spawn"; "process": BrokerProcessSpec }>
  | Readonly<{
    "kind" : "shell_execute";
    "shell": Readonly<{
      "script"     : string;
      "cwd"        : null;
      "environment": Readonly<Record<string, string>>;
    }>;
  }>
  | Readonly<{ "kind": "process_kill"; "handle": ResourceHandle }>;

export type BrokerResponse =
  | Readonly<{ "kind": "plugin_opened"; "session": SessionToken }>
  | Readonly<{
    "kind"       : "permission_requests_prepared";
    "descriptors": ReadonlyArray<PreparedPermissionRequest>;
  }>
  | Readonly<{ "kind": "plugin_granted" }>
  | Readonly<{ "kind": "plugin_revoked"; "alreadyRevoked": boolean }>
  | Readonly<{ "kind": "decision"; "decision": boolean | null }>
  | Readonly<{ "kind": "decision_saved" }>
  | Readonly<{ "kind": "unit" }>
  | Readonly<{ "kind": "paths"; "paths": ReadonlyArray<string> }>
  | Readonly<{ "kind": "exists"; "exists": boolean }>
  | Readonly<{
    "kind"                    : "file_metadata";
    "modifiedTimeMilliseconds": number | null;
  }>
  | Readonly<{ "kind": "system_memory"; "usedBytes": number; "totalBytes": number }>
  | Readonly<{ "kind": "global_cpu_usage"; "usage": number }>
  | Readonly<{ "kind": "booleans"; "values": ReadonlyArray<boolean> }>
  | Readonly<{ "kind": "text"; "text": string }>
  | Readonly<{ "kind": "bytes"; "bytes": ReadonlyArray<number> }>
  | Readonly<{
    "kind"   : "directory_entries";
    "entries": ReadonlyArray<Readonly<{
      "name"       : string;
      "isDirectory": boolean;
      "isFile"     : boolean;
      "isSymlink"  : boolean;
    }>>;
  }>
  | Readonly<{
    "kind"    : "http";
    "response": Readonly<{
      "status"    : number;
      "statusText": string;
      "headers"   : ReadonlyArray<Readonly<{ "name": string; "value": string }>>;
      "body"      : ReadonlyArray<number>;
      "url"       : string;
      "redirected": boolean;
    }>;
  }>
  | Readonly<{
    "kind"  : "process_output";
    "code"  : number | null;
    "stdout": ReadonlyArray<number>;
    "stderr": ReadonlyArray<number>;
  }>
  | Readonly<{ "kind": "process_spawned"; "handle": ResourceHandle; "pid": number }>
  | Readonly<{ "kind": "server_spawned"; "handle": ResourceHandle; "pid": number; "port": number }>
  | Readonly<{ "kind": "java_major"; "major": number }>
  | Readonly<{ "kind": "boolean"; "value": boolean }>
  | DownloadContract.DownloadReportResponse
  | Readonly<{
    "kind": "icon_picked";
    "icon": Readonly<{ "path": string; "bytes": ReadonlyArray<number> }> | null;
  }>
  | Readonly<{
    "kind"               : "runtime_snapshot";
    "runtimeKind"        : "desktop";
    "launchCount"        : number;
    "portable"           : boolean;
    "baseDirectory"      : string;
    "executableDirectory": string;
    "appDataDirectory"   : string;
    "os"                 : Readonly<{ "platform": string; "arch": string; "version": string }>;
  }>
  | Readonly<{ "kind": "initial_state"; "state": InitialState.InitialStateType }>
  | Readonly<{
    "kind"  : "extensions_read";
    "result": InstalledExtensionsReadResult;
  }>
  | Readonly<{
    "kind"  : "initialization_finalized";
    "report": InitialState.InitializationFinalizationReport;
  }>;
export type RawBrokerEvent =
  | Readonly<{ "kind": "stdout" | "stderr"; "handle": string; "bytes": ReadonlyArray<number> }>
  | Readonly<{
    "kind"  : "terminated";
    "handle": string;
    "code"  : number | null;
    "signal": number | null;
  }>
  | Readonly<{ "kind": "error"; "handle": string; "message": string }>
  | Readonly<{ "kind": "failed"; "handle": string; "message": string }>
  | Readonly<{
    "kind"          : "download_progress";
    "transferred"   : number;
    "total"         : number | null;
    "bytesPerSecond": number;
  }>
  | DownloadContract.DownloadBatchProgressEvent;
