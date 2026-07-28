import { reportBackgroundBrokerError } from "@/lib/capability-broker/background-errors.ts";
import type { SessionToken } from "@/lib/capability-broker/contract.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  createProcessResult,
  expectResponse,
  externalStoragePath,
  toPluginHttpRequest,
  toPluginHttpResponse,
} from "@/lib/capability-broker/desktop-codecs.ts";
import { createPluginProcess } from "@/lib/capability-broker/desktop-processes.ts";
import { UnsupportedBrokerOperationError } from "@/lib/capability-broker/errors.ts";
import type {
  PluginCapabilityFactories,
  PluginCapabilitySession,
  PluginEventCapabilityFactory,
} from "@/lib/capability-broker/types.ts";
import type { PluginPrincipal } from "@/lib/extensions-manager/scopes/principal.ts";
import type {
  BrokerBytes,
  EventSubscribeCapability,
  ExternalStorageTarget,
  LoggingCapability,
  LogLevel,
  NetworkHttpCapability,
  NetworkHttpRequest,
  NetworkHttpResponse,
  ProcessResult,
  ProcessSpawnCapability,
  ProcessSpawnRequest,
  ShellCapability,
  ShellExecuteRequest,
} from "@/types/extensions/permission.type.ts";

type EventFactoryProvider = () => PluginEventCapabilityFactory | undefined;

type PluginStorageOperations = Readonly<{
  "readBytes" : (path: string) => Promise<BrokerBytes>;
  "readText"  : (path: string) => Promise<string>;
  "writeText" : (path: string, contents: string) => Promise<void>;
  "writeBytes": (path: string, contents: BrokerBytes) => Promise<void>;
  "remove"    : (path: string) => Promise<void>;
}>;

function createPluginStorageOperations(pluginCall: BrokerCall): PluginStorageOperations {
  return Object.freeze({
    "readBytes": async path => {
      const response = expectResponse(await pluginCall({
        "kind"         : "plugin_fs_read_bytes",
        path,
        "baseDirectory": null,
      }), "bytes");

      return Object.freeze([...response.bytes]);
    },
    "readText": async path => {
      return expectResponse(await pluginCall({
        "kind"         : "plugin_fs_read_text",
        path,
        "baseDirectory": null,
      }), "text").text;
    },
    "writeText": async (path, contents) => {
      expectResponse(await pluginCall({
        "kind"         : "plugin_fs_write_text",
        path,
        contents,
        "baseDirectory": null,
      }), "unit");
    },
    "writeBytes": async (path, contents) => {
      expectResponse(await pluginCall({
        "kind" : "plugin_fs_write_bytes",
        path,
        "bytes": [...contents],
      }), "unit");
    },
    "remove": async path => {
      expectResponse(await pluginCall({ "kind": "plugin_fs_remove", path }), "unit");
    },
  });
}

function createPluginCapabilityFactories(
  principal: PluginPrincipal,
  pluginCall: BrokerCall,
  getEventFactory: EventFactoryProvider,
): PluginCapabilityFactories {
  const storage = createPluginStorageOperations(pluginCall);

  return Object.freeze({
    "network/http": (): NetworkHttpCapability => Object.freeze({
      "fetch": async (request: NetworkHttpRequest): Promise<NetworkHttpResponse> => {
        const response = expectResponse(await pluginCall({
          "kind"   : "plugin_http_fetch",
          "request": toPluginHttpRequest(request),
        }), "http");

        return toPluginHttpResponse(response.response);
      },
    }),
    "storage/internal/read": () => Object.freeze({
      "read"    : storage.readBytes,
      "readText": storage.readText,
    }),
    "storage/internal/write": () => Object.freeze({
      "write"    : storage.writeBytes,
      "writeText": storage.writeText,
      "remove"   : storage.remove,
    }),
    "storage/external/read": () => Object.freeze({
      "read"    : (target: ExternalStorageTarget) => storage.readBytes(externalStoragePath(target)),
      "readText": (target: ExternalStorageTarget) => storage.readText(externalStoragePath(target)),
    }),
    "storage/external/write": () => Object.freeze({
      "write": (target: ExternalStorageTarget, contents: BrokerBytes) => {
        return storage.writeBytes(externalStoragePath(target), contents);
      },
      "writeText": (target: ExternalStorageTarget, contents: string) => {
        return storage.writeText(externalStoragePath(target), contents);
      },
      "remove": (target: ExternalStorageTarget) => storage.remove(externalStoragePath(target)),
    }),
    "system/process/spawn": (): ProcessSpawnCapability => Object.freeze({
      "spawn": async (request: ProcessSpawnRequest) => {
        return createPluginProcess(pluginCall, request.path, request.arguments);
      },
    }),
    "system/shell": (): ShellCapability => Object.freeze({
      "execute": async (request: ShellExecuteRequest): Promise<ProcessResult> => {
        const response = expectResponse(await pluginCall({
          "kind" : "shell_execute",
          "shell": {
            "script"     : request.command,
            "cwd"        : null,
            "environment": {},
          },
        }), "process_output");

        return createProcessResult(response.code, null, response.stdout, response.stderr);
      },
    }),
    "events/subscribe": (): EventSubscribeCapability => {
      const factory = getEventFactory();

      if (factory === undefined) {
        throw new UnsupportedBrokerOperationError(
          "principal-specific frontend event subscription",
        );
      }

      return factory(principal);
    },
    "logging/write": (): LoggingCapability => Object.freeze({
      "write": (
        level: LogLevel,
        message: string,
        details?: ReadonlyArray<string>,
      ): void => {
        const fullMessage = details === undefined || details.length === 0
          ? message
          : [message, ...details].join(" ");

        void pluginCall({
          "kind"    : "log",
          level,
          "message" : fullMessage,
          "location": principal.pluginId,
        }).catch(error => {
          reportBackgroundBrokerError("Failed to write plugin broker log entry", error);
        });
      },
    }),
  } satisfies PluginCapabilityFactories);
}

export function createPluginCapabilitySession(
  principal: PluginPrincipal,
  pluginSession: SessionToken,
  pluginCall: BrokerCall,
  hostCall: BrokerCall,
  getEventFactory: EventFactoryProvider,
): PluginCapabilitySession {
  return Object.freeze({
    principal,
    "capabilityFactories": createPluginCapabilityFactories(
      principal,
      pluginCall,
      getEventFactory,
    ),
    "grant": async (
      prepared: Parameters<PluginCapabilitySession["grant"]>[0],
    ): Promise<void> => {
      expectResponse(await hostCall({
        "kind": "grant_plugin",
        pluginSession,
        prepared,
      }), "plugin_granted");
    },
    "grantAll": async (
      descriptors: Parameters<PluginCapabilitySession["grantAll"]>[0],
    ): Promise<void> => {
      for (const prepared of descriptors) {
        expectResponse(await hostCall({
          "kind": "grant_plugin",
          pluginSession,
          prepared,
        }), "plugin_granted");
      }
    },
    "revoke": async (): ReturnType<PluginCapabilitySession["revoke"]> => {
      const response = expectResponse(await hostCall({
        "kind": "revoke_plugin",
        pluginSession,
      }), "plugin_revoked");

      return Object.freeze({ "alreadyRevoked": response.alreadyRevoked });
    },
  } satisfies PluginCapabilitySession);
}
