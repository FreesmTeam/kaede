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

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { handleDatabase } from "@/lib/browser/scopes/handle-database.ts";
import { placeholderInvoke } from "@/lib/browser/scopes/placeholder-invoke.ts";

export async function handleTauriEnvironment(): Promise<void> {
  const { database } = await handleDatabase();

  GlobalInternals.indexedDB = database;
  window.__TAURI_INTERNALS__ = {
    "plugins": {
      "path": {
        "delimiter": ";",
        "sep"      : "\\",
      },
    },
    "callbacks"     : new Map,
    "convertFileSrc": (): void => {},
    "invoke"        : placeholderInvoke,
    "ipc"           : (): void => {},
    "metadata"      : {
      "currentWebview": { "label": "main" },
      "currentWindow" : { "label": "main" },
    },
    "postMessage"       : (): void => {},
    "runCallback"       : (): void => {},
    "transformCallback" : (): void => {},
    "unregisterCallback": (): void => {},
    "__TAURI_PATTERN__" : {
      "pattern": "brownfield",
    },
  };
  window.__TAURI_OS_PLUGIN_INTERNALS__ = {
    "eol"          : "unknown",
    "os_type"      : "linux",
    "platform"     : "linux",
    "family"       : "unix",
    "version"      : "unknown",
    "arch"         : "x86_64",
    "exe_extension": "unknown",
  };
}