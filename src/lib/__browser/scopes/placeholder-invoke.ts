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
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

/* eslint-disable max-lines */
import { LogInfo } from "@/constants/browser.ts";
import EnglishTranslations from "@/constants/english.json";
import { FamousAndOldJavaMajorVersion } from "@/constants/launcher";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { deleteStoragePath } from "@/lib/browser/scopes/delete-storage-path.ts";
import { digestBytes } from "@/lib/browser/scopes/digest-bytes.ts";
import { digestMd5 } from "@/lib/browser/scopes/digest-md5.ts";
import { getStoredFileInfo } from "@/lib/browser/scopes/get-stored-file-info.ts";
import {
  getCpuUsageReplica,
  getSystemMemoryReplica,
} from "@/lib/browser/scopes/get-system-stats.ts";
import { readArchiveEntryReplica, unzipStoredFiles } from "@/lib/browser/scopes/handle-archives.ts";
import {
  cancelBrowserDownloads,
  concurrentlyDownloadReplica,
} from "@/lib/browser/scopes/handle-downloads.ts";
import {
  addBrowserEventListener,
  emitBrowserEvent,
  removeBrowserEventListener,
} from "@/lib/browser/scopes/handle-events.ts";
import {
  cancelHttpRequest,
  cancelHttpRequestBody,
  readHttpRequestBody,
  registerHttpRequest,
  sendHttpRequest,
} from "@/lib/browser/scopes/handle-http-requests.ts";
import { installMrpackReplica, peekMrpackReplica } from "@/lib/browser/scopes/handle-mrpack.ts";
import {
  killPlaceholderProcess,
  listPlaceholderProcesses,
  spawnPlaceholderProcess,
  writeToPlaceholderProcess,
} from "@/lib/browser/scopes/handle-processes.ts";
import { listDirectoryEntries } from "@/lib/browser/scopes/list-directory-entries.ts";
import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { pickFile } from "@/lib/browser/scopes/pick-file.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";
import { readStoredBytes } from "@/lib/browser/scopes/read-stored-bytes.ts";
import { readStoredExtensions } from "@/lib/browser/scopes/read-stored-extensions.ts";
import { readStoredLocales } from "@/lib/browser/scopes/read-stored-locales.ts";
import { renameStoragePath } from "@/lib/browser/scopes/rename-storage-path.ts";
import {
  stopBrowserLogStream,
  streamBrowserLogs,
} from "@/lib/browser/scopes/stream-browser-logs.ts";
import { writeToStoragePath } from "@/lib/browser/scopes/write-to-storage-path.ts";
import Configs from "@/lib/configs";
import Instances from "@/lib/instances";


export async function placeholderInvoke(
  command: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any,
): Promise<unknown> {
  switch (command) {
    /* The application window and native dialogs */

    case "plugin:window|show": {
      return;
    }
    case "plugin:opener|reveal_item_in_dir": {
      const location: string = (payload?.paths?.[0] ?? "")
        .split("/")
        .slice(0, -1)
        .join("/");
      const storedPaths: Array<string> = await listStores(location);

      return alert(
        `Directory (${location})` +
        "\n" + "\n" +
        storedPaths
          .map(path => `- ${path}`)
          .join("\n"),
      );
    }
    case "plugin:opener|open_url": {
      window.open(payload?.url, "_blank", "noopener,noreferrer");

      return;
    }
    case "plugin:dialog|message": {
      return alert(
        `${payload?.title} (${payload?.kind})` +
        "\n" + "\n" +
        payload?.message,
      );
    }
    case "plugin:dialog|confirm":
    case "plugin:dialog|ask": {
      return confirm(
        `${payload?.title} (${payload?.kind})` +
        "\n" + "\n" +
        payload?.message,
      );
    }
    case "plugin:dialog|open": {
      return pickFile(payload?.options);
    }
    case "plugin:clipboard-manager|write_text": {
      return navigator.clipboard.writeText(payload?.text ?? "");
    }

    /*
     * OAuth2 needs a localhost redirect server,
     * and only the desktop application can start one
     */

    case "plugin:oauth|start": {
      throw "Signing in is unavailable in the browser preview: " +
        "it requires a localhost OAuth2 redirect server " +
        "that only the desktop application can start";
    }
    case "plugin:oauth|cancel": {
      return;
    }

    /* The event system */

    case "plugin:event|listen": {
      return addBrowserEventListener(payload.event, payload.handler);
    }
    case "plugin:event|unlisten": {
      return removeBrowserEventListener(payload.eventId);
    }
    case "plugin:event|emit":
    case "plugin:event|emit_to": {
      return emitBrowserEvent(payload.event, payload.payload);
    }

    /* Networking */

    case "plugin:upload|download": {
      const response: Response = await fetch(payload.url, { "headers": payload.headers });

      if (!response.ok) {
        throw `Failed to download ${payload.url}: ` +
          `the server responded with the '${response.status}' status`;
      }

      const blob: Blob = await response.blob();
      const filePath: string = payload.filePath;
      const name: string = filePath.split("/").pop() ?? filePath;

      await writeToStoragePath(filePath, new File([blob], name, { "type": blob.type }));

      return payload.onProgress?.onmessage?.({
        "progress"     : blob.size,
        "progressTotal": blob.size,
        "total"        : blob.size,
        "transferSpeed": 0,
      });
    }
    case "plugin:http|fetch": {
      return registerHttpRequest(payload.clientConfig);
    }
    case "plugin:http|fetch_cancel": {
      return cancelHttpRequest(payload.rid);
    }
    case "plugin:http|fetch_send": {
      return sendHttpRequest(payload.rid);
    }
    case "plugin:http|fetch_read_body": {
      return readHttpRequestBody(payload.rid);
    }
    case "plugin:http|fetch_cancel_body": {
      return cancelHttpRequestBody(payload.rid);
    }
    case "concurrently_download": {
      return concurrentlyDownloadReplica(payload);
    }
    case "cancel_downloads": {
      return cancelBrowserDownloads(payload.cancelId);
    }

    /* The file system */

    case "plugin:fs|mkdir": {
      return;
    }
    case "plugin:fs|exists": {
      const paths: Array<string> = await listStores(payload.path);

      return paths.length > 0;
    }
    case "plugin:fs|size": {
      const paths: Array<string> = await listStores(payload?.path);
      let size: number = 0;

      for (const path of paths) {
        const currentFile = await readStoragePath(path);

        size = size + (
          typeof currentFile === "string"
            // 'String#length' counts UTF-16 units while 'Blob#size' counts bytes
            ? (new Blob([currentFile])).size
            : currentFile.size
        );
      }

      return size;
    }
    case "plugin:fs|read_dir": {
      return listDirectoryEntries(payload.path);
    }
    case "plugin:fs|read_file":
    case "plugin:fs|read_text_file": {
      const input: string | File = await readStoragePath(payload?.path);
      const encoder: TextEncoder = new TextEncoder;

      /*
       * '<Tauri API>#readTextFile' expects Uint8Array,
       * and we cannot change/replace that function since Tauri API is frozen
       */
      if (typeof input === "string") {
        return encoder.encode(input);
      }

      const buffer = await input.arrayBuffer();

      return new Uint8Array(buffer);
    }
    case "plugin:fs|write_text_file": {
      const path: string = decodeURIComponent(options.headers.path);
      const contents: Uint8Array = payload;
      const decoder: TextDecoder = new TextDecoder;
      const output: string = decoder.decode(contents);

      return writeToStoragePath(path, output);
    }
    case "plugin:fs|write_file": {
      const path: string = decodeURIComponent(options.headers.path);
      const contents: Uint8Array = payload instanceof Uint8Array
        ? payload
        : new Uint8Array(payload);
      const name: string = path.split("/").pop() ?? path;

      return writeToStoragePath(
        path,
        new File([new Uint8Array(contents)], name),
      );
    }
    case "plugin:fs|rename": {
      return renameStoragePath(payload.oldPath, payload.newPath);
    }
    case "plugin:fs|remove": {
      const keys: Array<string> = await listStores(payload.path);

      if (keys.includes(payload.path)) {
        return deleteStoragePath(payload.path);
      }

      // The store has no directory records, so a directory is removed key by key
      for (const key of keys) {
        if (key.startsWith(`${payload.path}/`)) {
          await deleteStoragePath(key);
        }
      }

      return;
    }
    case "plugin:fs|stat":
    case "plugin:fs|lstat": {
      return getStoredFileInfo(payload.path);
    }

    /* Launcher files verification */

    case "verify_file_paths": {
      const artifacts: Array<{
        "path": string;
        "hash": string;
      }> = payload.artifacts;
      const verified: Array<string | undefined> = await Promise.all(
        artifacts.map(async ({ path, hash }) => {
          const bytes: Uint8Array | undefined = await readStoredBytes(path);

          if (bytes === undefined) {
            return path;
          }

          // Artifacts that did not specify SHA1 hashes have been assigned to 'ignore'
          if (hash === "ignore") {
            return;
          }

          const actual: string = await digestBytes("SHA-1", bytes);

          return actual === hash.toLowerCase() ? undefined : path;
        }),
      );

      return verified.filter(path => path !== undefined);
    }
    case "get_missing_files": {
      const paths: Array<string> = payload.paths;
      const keys: Array<string> = await listStores();
      const stored: Set<string> = new Set(keys);

      return paths.filter(path => (
        !stored.has(path) &&
        !keys.some(key => key.startsWith(`${path}/`))
      ));
    }

    /* Hashing */

    case "hash_sha256": {
      // The payload of this command is a raw 'Uint8Array' body
      return digestBytes("SHA-256", payload);
    }
    case "hash_md5": {
      return digestMd5(payload);
    }
    case "hash_sha1_file": {
      const bytes: Uint8Array | undefined = await readStoredBytes(payload.path);

      if (bytes === undefined) {
        throw `Failed to hash ${payload.path}: it does not exist in the browser storage`;
      }

      return digestBytes("SHA-1", bytes);
    }

    /* Archives */

    case "read_archive_entry": {
      return readArchiveEntryReplica(payload.archivePath, payload.entryPath);
    }
    case "unzip_files": {
      return unzipStoredFiles(payload.archiveFiles, payload.targetDirPath);
    }
    case "peek_mrpack": {
      return peekMrpackReplica(payload.archivePath);
    }
    case "install_mrpack": {
      return installMrpackReplica(payload.archivePath, payload.targetDirPath);
    }
    case "read_extensions": {
      return readStoredExtensions(payload.extensionsDirPath);
    }

    /* Processes */

    case "spawn_process": {
      return spawnPlaceholderProcess(payload.spec);
    }
    case "list_processes": {
      return listPlaceholderProcesses();
    }
    case "kill_process": {
      return killPlaceholderProcess(payload.pid);
    }
    case "write_process": {
      return writeToPlaceholderProcess(payload.pid);
    }
    case "run_process": {
      return {
        "code"   : 0,
        "success": true,
        "stdout" : "A Kaede Placeholder",
        "stderr" : "",
      };
    }
    case "plugin:shellx|execute": {
      return {
        "status": {
          "code"   : 0,
          "signal" : null,
          "success": true,
        },
        "stdout": "A Kaede Placeholder",
        "stderr": "A Kaede Placeholder",
      };
    }

    /* System information */

    case "get_system_memory": {
      return getSystemMemoryReplica();
    }
    case "get_cpu_usage": {
      return getCpuUsageReplica();
    }

    /* Logging */

    case "plugin:log|log": {
      const now: Date = new Date;
      const hours: number = now.getHours();
      const minutes: string = now
        .getMinutes()
        .toString()
        .padStart(2, "0");
      const seconds: string = now
        .getSeconds()
        .toString()
        .padStart(2, "0");
      const milliseconds: string = now
        .getMilliseconds()
        .toString()
        .padStart(3, "0");
      const time: string = `${hours}:${minutes}:${seconds}:${milliseconds}`;
      const message: string =
        time + LogInfo.delimiter +
        LogInfo.levels[payload.level as 1] + LogInfo.delimiter +
        `webview:${payload.location}` + LogInfo.delimiter +
        payload.message;
      const lines = message.split("\n");

      for (const line of lines) {
        GlobalInternals.logsInBrowser?.push?.(line);
      }

      return;
    }
    case "stream_logs": {
      return streamBrowserLogs(payload.onEvent);
    }
    case "stop_log_stream": {
      return stopBrowserLogStream();
    }

    /* Miscellaneous utilities */

    case "plugin:path|join": {
      const paths: Array<string> = payload?.paths ?? [];

      return paths.join("/");
    }
    case "plugin:app|version": {
      return "0.0.0";
    }
    case "get_locales": {
      return readStoredLocales(payload.directory);
    }

    /* Initialization */

    case "get_initial_state": {
      GlobalInternals.baseDirectory = "indexed_db";
      GlobalInternals.joinDelimiter = "/";

      const [config, accounts, instances] = await Promise.all([
        Configs.getSafe(),
        Configs.getAccounts(),
        Instances.readInstances(),
      ]);

      return {
        "basic": {
          "launcherVersion": "0.0.1-browser",
          "executableHash" : "",
          "baseDirectory"  : "indexed_db",
          "launchCount"    : 0,
          "separator"      : "/",
          "portable"       : true,
        },
        "parsed": {
          "config"      : { "status": "loaded", "data": config },
          "accounts"    : { "status": "loaded", "data": accounts },
          "instances"   : { "status": "loaded", "data": instances },
          "translations": { "status": "loaded", "data": EnglishTranslations },
        },
      };
    }
    case "finalize_initialization": {
      return {
        "createdDirectories": [],
        "javaMajor"         : FamousAndOldJavaMajorVersion,
        "javaMajorSource"   : "unresolved",
      };
    }
    case "get_java_major": {
      // There is no way to spawn a JVM or read its release file in the browser
      return {
        "major" : null,
        "source": "unresolved",
      };
    }
    case "detect_java_installations": {
      // There is no file system to scan for Java runtimes in the browser
      return [];
    }
    default: {
      // eslint-disable-next-line no-console
      console.log(command, payload, options);

      return;
    }
  }
}
