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

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { GlobalInternals } from "@/extendable/global-internals.ts";

let pending = false;

export async function recreateWebView(): Promise<void> {
  if (pending) {
    return;
  }

  pending = true;

  const id = getCurrentWindow().label === "reloaded" ? "switched-reloaded" : "reloaded";
  const webview = new WebviewWindow(id, GlobalInternals.webViewRecreation);

  return new Promise((resolve, reject) => {
    webview.once("tauri://created", async () => {
      await getCurrentWindow()
        .destroy()
        .catch(reject);

      resolve();
    });
    webview.once("tauri://error", error => {
      reject(error);
    });
  });
}
