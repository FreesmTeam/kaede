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

import { listen } from "@tauri-apps/api/event";

import { ProcessHandlers } from "@/lib/processes/core.ts";

export async function watchProcesses(): Promise<() => void> {
  const unlistenFunctions = await Promise.all([
    listen<{ "token": string; "pid": number; "stream": "stdout" | "stderr"; "line": string }>(
      "process-output",
      ({ payload }) => ProcessHandlers.get(payload.token)?.onOutput?.(payload.line, payload.stream),
    ),
    listen<{
      "token" : string;
      "pid"   : number;
      "kind"  : string;
      "code"  : number | null;
      "signal": number | null;
    }>(
      "process-exited",
      ({ payload }) => {
        const set = ProcessHandlers.get(payload.token);

        ProcessHandlers.delete(payload.token);
        set?.onExit?.(payload);
      },
    ),
    listen<{ "token": string; "pid": number; "message": string }>(
      "process-error",
      ({ payload }) => ProcessHandlers.get(payload.token)?.onError?.(payload),
    ),
  ]);

  return () => {
    for (const unlisten of unlistenFunctions) unlisten();
  };
}