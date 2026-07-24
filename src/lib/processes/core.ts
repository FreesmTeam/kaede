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

import { invoke } from "@tauri-apps/api/core";

import type {
  ProcessDtoType,
  ProcessHandlersType,
  ProcessHandleType,
} from "@/types/application/server-process.type.ts";

export const ProcessHandlers = new Map<string, ProcessHandlersType>;

export function toProcessHandle<Meta>({
  token,
  pid,
  kind,
  meta,
}: ProcessDtoType<Meta>): ProcessHandleType<Meta> {
  return {
    token, pid, kind, meta,
    "kill" : () => invoke("kill_process", { pid }),
    "write": data => invoke("write_process", {
      pid,
      "data": typeof data === "string" ? data : [...data],
    }),
  };
}

export async function rehydrateProcesses(
  attach: (handle: ProcessHandleType) => ProcessHandlersType | undefined,
): Promise<Array<ProcessHandleType>> {
  const DTOs = await invoke<Array<ProcessDtoType>>("list_processes");

  return DTOs.map(DTO => {
    const handle = toProcessHandle(DTO);
    const set = attach(handle);

    if (set !== undefined) {
      ProcessHandlers.set(DTO.token, set);
    }

    return handle;
  });
}