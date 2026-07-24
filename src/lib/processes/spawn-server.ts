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

import { log } from "@/lib/logging/scopes/log.ts";
import { hydrate } from "@/lib/processes/hydrate.ts";
import { spawnProcess } from "@/lib/processes/spawn-process.ts";
import { serverProcesses } from "@/states/servers.ts";
import type {
  ProgramSpecType,
  ServerMetaType,
  ServerProcessType,
} from "@/types/application/server-process.type.ts";

export async function spawnServer({ name, program, args, port }: {
  "name"   : string;
  "program": ProgramSpecType;
  "args"   : Array<string>;
  "port"   : number;
}): Promise<ServerProcessType> {
  const handle = await spawnProcess<ServerMetaType>({
    program, args,
    "kind": "extension-server",
    "meta": { name, port },
  }, {
    "onOutput": (line, stream) => (stream === "stdout" ? log.debug : log.error)(
      __PRE_BUNDLED_FILENAME__, "txiki server output:" + "\n", line,
    ),
    "onExit": () => {
      serverProcesses.value = serverProcesses.value.filter(item => item.name !== name);
    },
  });
  const process = hydrate(handle);

  serverProcesses.value = [...serverProcesses.value, process];

  return process;
}