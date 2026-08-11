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

import { loadWailsRuntime } from "@/lib/__wails/scopes/load-wails-runtime.ts";

/**
 * Reports whether the page is hosted by the Wails backend.
 *
 * Unlike the Tauri check, this one cannot be synchronous: nothing is injected
 * into the page before the scripts run, so the probe is the attempt to load
 * the runtime that only a Wails backend serves. The result is cached, so the
 * cost is paid once.
 *
 * @returns Whether the Wails backend is reachable.
 */
export async function detectIsWails(): Promise<boolean> {
  /*
   * A real Tauri build already owns the environment. This keeps the probe
   * from firing a pointless request when the desktop application is the host
   */
  if (window.__TAURI__ !== undefined) {
    return false;
  }

  return (await loadWailsRuntime()) !== undefined;
}
