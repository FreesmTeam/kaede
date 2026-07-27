import type {
  BrokerRequest,
  BrokerResponse,
  RawBrokerEvent,
} from "@/lib/capability-broker/contract.ts";
import type { DesktopIpc } from "@/lib/capability-broker/desktop-adapter.ts";
import {
  createPluginPrincipal,
  type PluginPrincipal,
} from "@/lib/extensions-manager/scopes/principal.ts";

export type InvokeArguments = Readonly<{
  "session": string;
  "request": BrokerRequest;
  "events"?: object;
}>;

type TauriInvokeArguments = Record<string, unknown> | number[] | ArrayBuffer | Uint8Array;
type IpcCall = Readonly<{ "command": string; "args": unknown }>;
type IpcMock = Readonly<{ "calls": Array<IpcCall>; "ipc": DesktopIpc }>;

export function noEventCapability(): undefined {
  return;
}

export function principal(pluginId: string): PluginPrincipal {
  return createPluginPrincipal({
    "repositoryOrigin": "https://plugins.example.test/owner/repository",
    pluginId,
    "version"         : "1.0.0",
    "artifactSha256"  : "a".repeat(64),
  });
}

export function createIpcMock(): IpcMock {
  const calls: Array<IpcCall> = [];
  const handlers = new WeakMap<object, (event: RawBrokerEvent) => void>;
  const processOwners = new Map<string, string>;
  let pluginIndex = 0;
  const channel: DesktopIpc["channel"] = handler => {
    const value = {};

    handlers.set(value, handler);

    return value as ReturnType<DesktopIpc["channel"]>;
  };
  const mockedInvoke: DesktopIpc["invoke"] = async <Result>(
    command: string,
    arguments_?: TauriInvokeArguments,
  ): Promise<Result> => {
    calls.push({ command, "args": arguments_ });

    if (command === "bootstrap_capability_broker") {
      return { "session": "host-secret", "generation": 7 } as Result;
    }

    const input = arguments_ as InvokeArguments;
    const request = input.request;
    let response: BrokerResponse;

    switch (request.kind) {
      case "host_runtime_snapshot": {
        response = {
          "kind"               : "runtime_snapshot",
          "runtimeKind"        : "desktop",
          "launchCount"        : 3,
          "portable"           : false,
          "baseDirectory"      : "/app/data",
          "executableDirectory": "/app/bin",
          "appDataDirectory"   : "/app/data",
          "os"                 : { "platform": "linux", "arch": "x86_64", "version": "1" },
        };
        break;
      }
      case "host_system_memory": {
        response = {
          "kind"      : "system_memory",
          "usedBytes" : 4_294_967_296,
          "totalBytes": 8_589_934_592,
        };
        break;
      }
      case "host_global_cpu_usage": {
        response = { "kind": "global_cpu_usage", "usage": 12.5 };
        break;
      }
      case "host_hash_md5": {
        response = { "kind": "text", "text": "d41d8cd98f00b204e9800998ecf8427e" };
        break;
      }
      case "host_hash_sha256": {
        response = {
          "kind": "text",
          "text": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        };
        break;
      }
      case "host_fs_metadata": {
        response = {
          "kind"                    : "file_metadata",
          "modifiedTimeMilliseconds": 1_753_488_000_000,
        };
        break;
      }
      case "host_initial_state": {
        response = {
          "kind" : "initial_state",
          "state": {
            "basic": {
              "launcherVersion": "1.2.3",
              "baseDirectory"  : "/app/data",
              "launchCount"    : 3,
              "separator"      : "/",
              "portable"       : false,
            },
            "parsed": {
              "config"      : { "status": "loaded", "data": { "layout": "test" } },
              "accounts"    : { "status": "missing" },
              "instances"   : { "status": "missing" },
              "translations": {
                "status": "corrupt",
                "raw"   : "{",
                "error" : "unexpected end of input",
              },
            },
          },
        };
        break;
      }
      case "host_finalize_initialization": {
        response = {
          "kind"  : "initialization_finalized",
          "report": {
            "createdDirectories": ["/app/data/assets", "/app/data/libraries"],
            "javaMajor"         : 21,
            "javaMajorSource"   : "release-file",
          },
        };
        break;
      }
      case "host_read_extensions": {
        response = {
          "kind"  : "extensions_read",
          "result": {
            "extensions": [{
              "fileName"      : "sample.kaede",
              "metadata"      : { "id": "sample" },
              "code"          : "void 0",
              "artifactSha256": "a".repeat(64),
            }],
            "failures": [{ "fileName": "broken.zip", "error": "invalid zip" }],
          },
        };
        break;
      }
      case "open_plugin": {
        pluginIndex += 1;
        response = { "kind": "plugin_opened", "session": `plugin-secret-${pluginIndex}` };
        break;
      }
      case "prepare_permission_requests": {
        response = {
          "kind"       : "permission_requests_prepared",
          "descriptors": request.descriptors.map(descriptor => {
            if (
              typeof descriptor !== "string" &&
              descriptor.id === "storage/external/read"
            ) {
              return {
                "descriptor": {
                  ...descriptor,
                  "scope": { "roots": ["/canonical/storage"] },
                },
                "targetIdentities": [{
                  "kind"            : "external_storage_root",
                  "path"            : "/canonical/storage",
                  "identityProvider": "desktop-filesystem-v1",
                  "device"          : "8",
                  "inode"           : "80",
                }],
              };
            }

            return { descriptor, "targetIdentities": [] };
          }),
        };
        break;
      }
      case "grant_plugin": {
        response = { "kind": "plugin_granted" };
        break;
      }
      case "plugin_process_spawn": {
        const handle = `handle-${input.session}`;

        processOwners.set(handle, input.session);
        const handler = input.events === undefined ? undefined : handlers.get(input.events);

        handler?.({ "kind": "stdout", handle, "bytes": [65, 66] });
        handler?.({ "kind": "stderr", handle, "bytes": [67] });
        handler?.({ "kind": "terminated", handle, "code": 0, "signal": null });
        response = { "kind": "process_spawned", handle, "pid": pluginIndex + 40 };
        break;
      }
      case "process_kill": {
        if (processOwners.get(request.handle) !== input.session) {
          throw new Error("resource owned by another plugin session");
        }

        response = { "kind": "unit" };
        break;
      }
      case "host_http_fetch": {
        response = {
          "kind"    : "http",
          "response": {
            "status"    : 201,
            "statusText": "Created",
            "headers"   : [{ "name": "content-type", "value": "application/octet-stream" }],
            "body"      : [0, 127, 255],
            "url"       : "https://example.test/final",
            "redirected": true,
          },
        };
        break;
      }
      case "host_download_batch": {
        const handler = input.events === undefined ? undefined : handlers.get(input.events);

        handler?.({
          "kind"   : "download_batch_progress",
          "current": { "/app/data/libraries/example.jar": [75, 4096] },
          "success": 0,
          "failed" : 0,
        });
        handler?.({
          "kind"   : "download_batch_progress",
          "current": {},
          "success": 1,
          "failed" : 0,
        });
        response = {
          "kind"     : "download_report",
          "success"  : 1,
          "failed"   : 0,
          "cancelled": false,
          "failures" : [],
        };
        break;
      }
      case "host_cancel_downloads": {
        response = { "kind": "boolean", "value": true };
        break;
      }
      default: {
        response = { "kind": "unit" };
      }
    }

    return response as Result;
  };

  return {
    calls,
    "ipc": { "invoke": mockedInvoke, channel } satisfies DesktopIpc,
  };
}
