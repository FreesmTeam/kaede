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

import { emitBrowserEvent } from "@/lib/browser/scopes/handle-events.ts";

/*
 * Browsers cannot spawn operating system processes, so the replicas
 * register a placeholder that emits the same 'process-output' and
 * 'process-exited' events as the desktop 'processes.rs' module.
 * The placeholder idles until it is killed, which keeps the whole
 * "running instance" user interface interactive in the live preview
 */

type SpawnSpecType = {
  "token"  : string;
  "program": {
    "type" : "path" | "sidecar";
    "value": string;
  };
  "args"?: Array<string>;
  "cwd"? : string;
  "env"? : Record<string, string>;
  "kind" : string;
  "meta" : unknown;
};

type ProcessDtoType = {
  "token": string;
  "pid"  : number;
  "kind" : string;
  "meta" : unknown;
};

const processes: Map<number, ProcessDtoType> = new Map;

let nextPid: number = 1;

export function spawnPlaceholderProcess(spec: SpawnSpecType): ProcessDtoType {
  const pid: number = nextPid++;
  const dto: ProcessDtoType = {
    "token": spec.token,
    pid,
    "kind" : spec.kind,
    "meta" : spec.meta,
  };

  processes.set(pid, dto);

  // Deferred so the caller can attach its process handlers first
  setTimeout((): void => {
    if (!processes.has(pid)) {
      return;
    }

    emitBrowserEvent("process-output", {
      "token" : spec.token,
      pid,
      "stream": "stdout",
      "lines" : [
        `A Kaede Placeholder: pretending to run '${spec.program.value}'`,
        "Operating system processes cannot be spawned in a browser,",
        "so this one just idles until it is stopped",
      ],
    });
  }, 100);

  return dto;
}

export function listPlaceholderProcesses(): Array<ProcessDtoType> {
  return [...processes.values()];
}

export function killPlaceholderProcess(pid: number): void {
  const dto: ProcessDtoType | undefined = processes.get(pid);

  if (!dto) {
    // The same message as in 'processes.rs'
    throw `no managed process with pid ${pid}`;
  }

  processes.delete(pid);
  emitBrowserEvent("process-exited", {
    "token" : dto.token,
    pid,
    "kind"  : dto.kind,
    "code"  : 0,
    "signal": null,
  });
}

export function writeToPlaceholderProcess(pid: number): void {
  if (!processes.has(pid)) {
    throw `no managed process with pid ${pid}`;
  }
}
