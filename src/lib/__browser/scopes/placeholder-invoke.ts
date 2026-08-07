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

/* eslint-disable max-lines */
import { LogInfo } from "@/constants/browser.ts";
import EnglishTranslations from "@/constants/english.json";
import { FamousAndOldJavaMajorVersion } from "@/constants/launcher";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { handleBodyRead } from "@/lib/browser/scopes/handle-body-read.ts";
import { listStores } from "@/lib/browser/scopes/list-stores.ts";
import { readStoragePath } from "@/lib/browser/scopes/read-storage-path.ts";
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
    case "plugin:dialog|message": {
      return alert(
        `${payload?.title} (${payload?.kind})` +
        "\n" + "\n" +
        payload?.message,
      );
    }
    case "plugin:dialog|confirm": {
      return confirm(
        `${payload?.title} (${payload?.kind})` +
        "\n" + "\n" +
        payload?.message,
      );
    }
    case "plugin:upload|download": {
      const response: Response = await fetch(payload.url);
      const body: string = await response.text();

      return writeToStoragePath(payload.filePath, body);
    }
    case "plugin:http|fetch": {
      // So-called "rid"
      return {
        "url"   : payload.clientConfig.url,
        "method": payload.clientConfig.method,
      };
    }
    case "plugin:http|fetch_send": {
      const response: Response = await fetch(
        payload.rid.url,
        { "method": payload.rid.method },
      );

      return {
        "status"    : response.status,
        "statusText": response.statusText,
        "headers"   : response.headers,
        "url"       : payload.rid.url,
        "rid"       : { "rid": payload.rid, response },
      };
    }
    case "plugin:http|fetch_read_body": {
      const response: Response = payload.rid.response;
      // All this from the Firefox Debugger of "@tauri-apps/plugin-http/dist-js"
      const streamChannel = payload.streamChannel;

      return handleBodyRead(response, streamChannel);
    }
    case "get_executable_directory": {
      return "indexed_db";
    }
    case "verify_file_paths": {
      const artifacts: Array<{
        "shortHashPath": string;
        "hash"         : string;
        "url"          : string;
        "path"         : string;
      }> = payload.artifacts;
      const directories: Set<string> = new Set(await listStores("indexed_db/"));
      const missing: Array<string> = [];

      for (const { path } of artifacts) {
        if (!directories.has(path)) {
          missing.push(path);
        }
      }

      return missing;
    }
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
            ? currentFile.length
            : currentFile.size
        );
      }

      return size;
    }
    case "plugin:fs|read_dir": {
      return listStores(payload.path);
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
    case "plugin:path|join": {
      const paths: Array<string> = payload?.paths ?? [];

      return paths.join("/");
    }
    case "plugin:app|version": {
      return "0.0.0";
    }
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
    case "detect_java_installations": {
      // There is no file system to scan for Java runtimes in the browser
      return [];
    }
    case "plugin:dialog|open": {
      const input = document.createElement("input");

      input.type = "file";
      input.accept = "image/*";

      const filePath = new Promise<string>((resolve, reject): void => {
        input.addEventListener("change", async event => {
          if (!event.target) {
            return reject();
          }

          const target = event.target as HTMLInputElement;
          const file: File | undefined = target?.files?.[0];

          if (!file) {
            return reject();
          }

          try {
            const reader = new FileReader;

            reader.readAsDataURL(file);

            reader.addEventListener("load", () => {
              if (typeof reader.result !== "string") {
                return reject();
              }

              return resolve(reader.result);
            });
            reader.addEventListener("error", reject);

            return;
          } catch {
            return reject();
          }
        });
      });

      input.click();

      return await filePath;
    }
    default: {
      // eslint-disable-next-line no-console
      console.log(command, payload, options);

      return;
    }
  }
}
