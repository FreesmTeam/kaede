import { reportBackgroundBrokerError } from "@/lib/capability-broker/background-errors.ts";
import type { BrokerCall } from "@/lib/capability-broker/desktop-codecs.ts";
import {
  expectResponse,
  toBrokerHttpRequest,
  toResponse,
} from "@/lib/capability-broker/desktop-codecs.ts";
import {
  toDownloadBatchSnapshot,
  toDownloadReport,
} from "@/lib/capability-broker/desktop-host-codecs.ts";
import type {
  HostFacade,
  HostHttpRequestInit,
} from "@/lib/capability-broker/types.ts";

export type DesktopHostIo = Readonly<{
  "http"     : HostFacade["http"];
  "downloads": HostFacade["downloads"];
  "dialogs"  : HostFacade["dialogs"];
  "opener"   : HostFacade["opener"];
  "logs"     : HostFacade["logs"];
}>;

type DownloadInput = Parameters<HostFacade["downloads"]["toFile"]>[0];
type DownloadProgressHandler = Parameters<HostFacade["downloads"]["toFile"]>[1];
type DownloadBatchInput = Parameters<HostFacade["downloads"]["batch"]>[0];
type DownloadBatchProgressHandler = Parameters<HostFacade["downloads"]["batch"]>[1];
type DialogMessageInput = Parameters<HostFacade["dialogs"]["message"]>[0];
type DialogAskInput = Parameters<HostFacade["dialogs"]["ask"]>[0];
type LogInput = Parameters<HostFacade["logs"]["write"]>[0];

export function createDesktopHostIo(call: BrokerCall): DesktopHostIo {
  return Object.freeze({
    "http": Object.freeze({
      "fetch": async (input: string | URL, init?: HostHttpRequestInit): Promise<Response> => {
        const response = expectResponse(await call({
          "kind"   : "host_http_fetch",
          "request": await toBrokerHttpRequest(input, init),
        }), "http");

        return toResponse(response.response);
      },
    }),
    "downloads": Object.freeze({
      "toFile": async (
        input: DownloadInput,
        onProgress: DownloadProgressHandler,
      ): Promise<void> => {
        const request = await toBrokerHttpRequest(input.url);

        expectResponse(await call({
          "kind"         : "host_http_download",
          request,
          "destination"  : input.destinationPath,
          "baseDirectory": null,
        }, event => {
          if (event.kind === "download_progress") {
            onProgress(Object.freeze({
              "transferred"   : event.transferred,
              "total"         : event.total,
              "bytesPerSecond": event.bytesPerSecond,
            }));
          }
        }), "http");
      },
      "batch": async (
        input: DownloadBatchInput,
        onProgress: DownloadBatchProgressHandler,
      ) => {
        const response = expectResponse(await call({
          "kind"       : "host_download_batch",
          "entries"    : input.entries,
          "concurrency": input.concurrency,
          "label"      : input.label,
          "cancelId"   : input.cancelId,
        }, event => {
          if (event.kind === "download_batch_progress") {
            onProgress(toDownloadBatchSnapshot({
              "current": event.current,
              "success": event.success,
              "failed" : event.failed,
            }));
          }
        }), "download_report");

        return toDownloadReport({
          "success"  : response.success,
          "failed"   : response.failed,
          "cancelled": response.cancelled,
          "failures" : response.failures,
        });
      },
      "cancel": async (cancelId: string): Promise<boolean> => {
        return expectResponse(await call({
          "kind": "host_cancel_downloads",
          cancelId,
        }), "boolean").value;
      },
    }),
    "dialogs": Object.freeze({
      "message": async (input: DialogMessageInput): Promise<void> => {
        expectResponse(await call({
          "kind"      : "dialog_message",
          "title"     : input.title,
          "message"   : input.message,
          "dialogKind": input.kind,
        }), "unit");
      },
      "ask": async (input: DialogAskInput): Promise<boolean> => {
        return expectResponse(await call({
          "kind"      : "dialog_ask",
          "title"     : input.title,
          "message"   : input.message,
          "dialogKind": input.kind,
        }), "boolean").value;
      },
    }),
    "opener": Object.freeze({
      "revealItem": async (path: string): Promise<void> => {
        expectResponse(await call({ "kind": "opener_reveal", path }), "unit");
      },
    }),
    "logs": Object.freeze({
      "write": (input: LogInput): void => {
        void call({ "kind": "log", ...input }).catch(error => {
          reportBackgroundBrokerError("Failed to write broker log entry", error);
        });
      },
    }),
  });
}
