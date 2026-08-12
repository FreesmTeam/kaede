/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * ATTENTION: AI-generated (by Claude Opus 5 on 'max' reasoning)
 */

/* eslint-disable max-lines */
import { callService } from "@/lib/wails/scopes/call-service.ts";
import { fromBase64, toBase64, toBytes } from "@/lib/wails/scopes/handle-binary.ts";
import { openStream, type StreamType } from "@/lib/wails/scopes/handle-channels.ts";
import {
  addWailsEventListener,
  emitWailsEvent,
  removeWailsEventListener,
} from "@/lib/wails/scopes/handle-events.ts";
import { getEnvironment } from "@/lib/wails/scopes/read-environment.ts";
import {
  cancelRequest,
  readRequestBody,
  registerRequest,
  sendRequest,
} from "@/lib/wails/scopes/route-http.ts";

/*
 * The Wails counterpart of the browser 'placeholderInvoke'.
 *
 * Every Tauri IPC command the application can reach is translated into a call
 * on a Go service. The switch deliberately follows the same order and the
 * same grouping as the browser replica, so the two can be read side by side
 */

type DialogFilterType = {
  "name"      : string;
  "extensions": Array<string>;
};

type OpenDialogOptionsType = {
  "multiple"?   : boolean;
  "directory"?  : boolean;
  "title"?      : string;
  "defaultPath"?: string;
  "filters"?    : Array<DialogFilterType>;
};

type UnzipOutcomeType = {
  "ok"   : boolean;
  "error": string;
};

/*
 * Tauri's file dialog groups extensions per named filter, while the Go side
 * takes a display name to pattern map. Patterns are semicolon separated,
 * which is what the native pickers expect on every platform
 */
function toDialogFilters(filters?: Array<DialogFilterType>): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const filter of filters ?? []) {
    mapped[filter.name] = filter.extensions
      .map(extension => `*.${extension}`)
      .join(";");
  }

  return mapped;
}

// A picked path is read back as a plain string, or as an array when multiple
function toPickedPaths(
  selection: Array<string>,
  multiple?: boolean,
): string | Array<string> | null {
  if (multiple) {
    return selection;
  }

  return selection[0] ?? null;
}

/*
 * Reads a path out of the request headers.
 *
 * The file system plugin sends the contents as the raw body for writes, so
 * the destination travels in a header instead of in the payload
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readHeaderPath(options: any): string {
  return decodeURIComponent(options?.headers?.path ?? "");
}

/*
 * Runs a call that reports progress through a Tauri channel.
 *
 * The stream is detached in a 'finally' so that a rejected call cannot leave
 * a forwarder subscribed to an event nobody reads any more
 */
async function withStream(
  channel: unknown,
  run: (streamId: string) => Promise<unknown>,
): Promise<unknown> {
  const stream: StreamType = await openStream(channel);

  try {
    return await run(stream.id);
  } finally {
    stream.close();
  }
}

export async function wailsInvoke(
  command: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
): Promise<unknown> {
  switch (command) {
    /* The application window and native dialogs */

    case "plugin:window|show": {
      return callService("ShellService.ShowWindow");
    }
    case "plugin:opener|reveal_item_in_dir": {
      return callService("ShellService.RevealItemInDir", payload?.paths?.[0] ?? "");
    }
    case "plugin:opener|open_url": {
      return callService("ShellService.OpenURL", payload?.url ?? "");
    }
    case "plugin:dialog|message": {
      return callService(
        "ShellService.Message",
        payload?.title ?? "",
        payload?.message ?? "",
        payload?.kind ?? "info",
      );
    }
    case "plugin:dialog|confirm":
    case "plugin:dialog|ask": {
      return callService(
        "ShellService.Confirm",
        payload?.title ?? "",
        payload?.message ?? "",
        payload?.kind ?? "info",
        payload?.okLabel ?? "Yes",
        payload?.cancelLabel ?? "No",
      );
    }
    case "plugin:dialog|open": {
      const dialogOptions: OpenDialogOptionsType = payload?.options ?? {};
      const selection = await callService(
        "ShellService.PickFiles",
        dialogOptions.title ?? "",
        dialogOptions.defaultPath ?? "",
        dialogOptions.multiple ?? false,
        dialogOptions.directory ?? false,
        toDialogFilters(dialogOptions.filters),
      ) as Array<string> | null;

      return toPickedPaths(selection ?? [], dialogOptions.multiple);
    }
    case "plugin:clipboard-manager|write_text": {
      return callService("ShellService.WriteClipboardText", payload?.text ?? "");
    }

    /* OAuth2 runs a localhost redirect server inside the Go backend */

    case "plugin:oauth|start": {
      return callService("OAuthService.Start", payload?.config?.response ?? "");
    }
    case "plugin:oauth|cancel": {
      return callService("OAuthService.Cancel", payload?.port ?? 0);
    }

    /* The event system */

    case "plugin:event|listen": {
      return addWailsEventListener(payload.event, payload.handler);
    }
    case "plugin:event|unlisten": {
      return removeWailsEventListener(payload.eventId);
    }
    case "plugin:event|emit":
    case "plugin:event|emit_to": {
      return emitWailsEvent(payload.event, payload.payload);
    }

    /* Networking */

    case "plugin:upload|download": {
      return withStream(payload.onProgress, (streamId: string) => callService(
        "DownloadService.DownloadFile",
        payload.url,
        payload.filePath,
        payload.headers ?? {},
        streamId,
      ));
    }
    case "plugin:http|fetch": {
      return registerRequest(payload.clientConfig);
    }
    case "plugin:http|fetch_cancel": {
      return cancelRequest(payload.rid);
    }
    case "plugin:http|fetch_send": {
      return sendRequest(payload.rid);
    }
    case "plugin:http|fetch_read_body": {
      return readRequestBody(payload.rid);
    }
    case "plugin:http|fetch_cancel_body": {
      // The service releases the body together with the request
      return cancelRequest(payload.rid);
    }
    case "concurrently_download": {
      return withStream(payload.onProgress, (streamId: string) => callService(
        "DownloadService.ConcurrentlyDownload",
        payload.entries,
        payload.concurrency,
        payload.label ?? "",
        payload.cancelId,
        streamId,
        payload.debug ?? false,
      ));
    }
    case "cancel_downloads": {
      return callService("DownloadService.CancelDownloads", payload.cancelId);
    }

    /* The file system */

    case "plugin:fs|mkdir": {
      return callService(
        "FilesystemService.Mkdir",
        payload.path,
        payload?.options?.recursive ?? false,
      );
    }
    case "plugin:fs|exists": {
      return callService("FilesystemService.Exists", payload.path);
    }
    case "plugin:fs|size": {
      return callService("FilesystemService.Size", payload.path);
    }
    case "plugin:fs|read_dir": {
      return callService("FilesystemService.ReadDir", payload.path);
    }
    case "plugin:fs|read_file":
    case "plugin:fs|read_text_file": {
      /*
       * '<Tauri API>#readTextFile' decodes the bytes itself, and the API is
       * frozen, so both variants have to answer with a 'Uint8Array'
       */
      const contents = await callService("FilesystemService.ReadFile", payload.path) as string;

      return fromBase64(contents);
    }
    case "plugin:fs|write_text_file": {
      const decoder: TextDecoder = new TextDecoder;

      return callService(
        "FilesystemService.WriteTextFile",
        readHeaderPath(options),
        decoder.decode(toBytes(payload)),
      );
    }
    case "plugin:fs|write_file": {
      return callService(
        "FilesystemService.WriteFile",
        readHeaderPath(options),
        toBase64(toBytes(payload)),
      );
    }
    case "plugin:fs|rename": {
      return callService("FilesystemService.Rename", payload.oldPath, payload.newPath);
    }
    case "plugin:fs|remove": {
      return callService(
        "FilesystemService.Remove",
        payload.path,
        payload?.options?.recursive ?? true,
      );
    }
    case "plugin:fs|stat": {
      return callService("FilesystemService.Stat", payload.path);
    }
    case "plugin:fs|lstat": {
      return callService("FilesystemService.Lstat", payload.path);
    }

    /* Launcher files verification */

    case "verify_file_paths": {
      return callService("LauncherService.VerifyFilePaths", payload.artifacts);
    }
    case "get_missing_files": {
      return callService("LauncherService.GetMissingFiles", payload.paths);
    }

    /* Hashing */

    case "hash_sha256": {
      // The payload of this command is a raw 'Uint8Array' body
      return callService("HashService.Sha256", toBase64(toBytes(payload)));
    }
    case "hash_md5": {
      return callService("HashService.Md5", toBase64(toBytes(payload)));
    }
    case "hash_sha1_file": {
      return callService("HashService.Sha1File", payload.path);
    }

    /* Archives */

    case "read_archive_entry": {
      const entry = await callService(
        "ArchiveService.ReadArchiveEntry",
        payload.archivePath,
        payload.entryPath,
      ) as string | null;

      if (entry === null) {
        return null;
      }

      // The Rust command answered with a plain array of byte values
      return [...fromBase64(entry)];
    }
    case "unzip_files": {
      const outcome = await callService(
        "ArchiveService.UnzipFiles",
        payload.archiveFiles,
        payload.targetDirPath,
      ) as UnzipOutcomeType;

      // This command never rejects: it resolves to 'true' or to the reason
      return outcome.ok ? true : outcome.error;
    }
    case "peek_mrpack": {
      return callService("ArchiveService.PeekMrpack", payload.archivePath);
    }
    case "install_mrpack": {
      return callService(
        "ArchiveService.InstallMrpack",
        payload.archivePath,
        payload.targetDirPath,
      );
    }
    case "read_extensions": {
      return callService("ArchiveService.ReadExtensions", payload.extensionsDirPath);
    }

    /* Processes */

    case "spawn_process": {
      return callService("ProcessService.SpawnProcess", payload.spec);
    }
    case "list_processes": {
      return callService("ProcessService.ListProcesses");
    }
    case "kill_process": {
      return callService("ProcessService.KillProcess", payload.pid);
    }
    case "write_process": {
      return callService("ProcessService.WriteProcess", payload.pid, payload.data);
    }
    case "run_process": {
      return callService("ProcessService.RunProcess", payload.spec);
    }
    case "plugin:shellx|execute": {
      return callService("ShellService.Execute", payload?.program ?? "", payload?.args ?? []);
    }

    /* System information */

    case "get_system_memory": {
      return callService("SystemService.GetSystemMemory");
    }
    case "get_cpu_usage": {
      return callService("SystemService.GetCPUUsage");
    }

    /* Logging */

    case "plugin:log|log": {
      return callService(
        "LoggingService.WriteLog",
        payload.level,
        payload.location ?? "",
        payload.message ?? "",
      );
    }
    case "stream_logs": {
      // This call intentionally stays pending until the stream is stopped
      return withStream(payload.onEvent, (streamId: string) => callService(
        "LoggingService.StreamLogs",
        streamId,
      ));
    }
    case "stop_log_stream": {
      return callService("LoggingService.StopLogStream");
    }

    /* Miscellaneous utilities */

    case "plugin:path|join": {
      const paths: Array<string> = payload?.paths ?? [];

      return paths.join(getEnvironment().separator);
    }
    case "plugin:app|version": {
      return getEnvironment().appVersion;
    }
    case "get_locales": {
      return callService("TranslationsService.GetLocales", payload.directory);
    }

    /* Initialization */

    case "get_initial_state": {
      return callService("LauncherService.GetInitialState");
    }
    case "finalize_initialization": {
      return callService(
        "FinalizationService.FinalizeInitialization",
        payload.baseDirectory,
        payload.folders,
        payload.javaBinary ?? null,
      );
    }
    case "get_java_major": {
      return callService("FinalizationService.GetJavaMajor", payload?.javaBinary ?? "");
    }
    case "detect_java_installations": {
      return callService("FinalizationService.DetectJavaInstallations");
    }
    default: {
      // eslint-disable-next-line no-console
      console.log(command, payload, options);

      return;
    }
  }
}
