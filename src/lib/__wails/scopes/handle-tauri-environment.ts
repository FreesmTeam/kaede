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

import { exposeGlobalTauri } from "@/lib/__wails/scopes/expose-global-tauri.ts";
import {
  runCallbackReplica,
  transformCallbackReplica,
  unregisterCallbackReplica,
} from "@/lib/__wails/scopes/handle-events.ts";
import { type EnvironmentType, loadEnvironment } from "@/lib/__wails/scopes/read-environment.ts";
import { wailsInvoke } from "@/lib/__wails/scopes/wails-invoke.ts";

/*
 * The route the Go backend serves local files on. It stands in for the Tauri
 * asset protocol, which is what 'convertFileSrc' produces URLs for
 */
const AssetRoute: string = "/kaede-file/?path=";

/*
 * 'window.__TAURI_OS_PLUGIN_INTERNALS__' is not part of the application's own
 * global declarations, it belongs to the Tauri OS plugin. Assigning through a
 * narrow local shape keeps that detail out of the shared declarations
 */
type TauriOsInternalsType = {
  "eol"          : string;
  "os_type"      : string;
  "platform"     : string;
  "family"       : string;
  "version"      : string;
  "arch"         : string;
  "exe_extension": string;
};

type OsGlobalType = {
  "__TAURI_OS_PLUGIN_INTERNALS__": TauriOsInternalsType;
};

export async function handleTauriEnvironment(): Promise<void> {
  const environment: EnvironmentType = await loadEnvironment();

  (window as unknown as OsGlobalType).__TAURI_OS_PLUGIN_INTERNALS__ = {
    "eol"          : environment.eol,
    "os_type"      : environment.osType,
    "platform"     : environment.platform,
    "family"       : environment.family,
    "version"      : environment.version,
    "arch"         : environment.arch,
    "exe_extension": environment.exeExtension,
  };

  window.__TAURI_INTERNALS__ = {
    "plugins": {
      "path": {
        "delimiter": environment.delimiter,
        "sep"      : environment.separator,
      },
    },
    "callbacks": new Map,

    /*
     * Local images are shown through a backend route rather than through a
     * data URL, so that large icons do not have to be held in memory
     */
    "convertFileSrc": (path: string): string => AssetRoute + encodeURIComponent(path),
    "invoke"        : wailsInvoke,
    "ipc"           : (): void => {},
    "metadata"      : {
      "currentWebview": { "label": "main" },
      "currentWindow" : { "label": "main" },
    },
    "postMessage"       : (): void => {},
    "runCallback"       : runCallbackReplica,
    "transformCallback" : transformCallbackReplica,
    "unregisterCallback": unregisterCallbackReplica,
    "__TAURI_PATTERN__" : {
      "pattern": "brownfield",
    },
  };

  await exposeGlobalTauri();
}
