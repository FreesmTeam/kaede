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

import { shallowRef } from "vue";

import { log } from "@/lib/logging/log.ts";
import { rehydrateProcesses } from "@/lib/processes/core.ts";
import { hydrate } from "@/lib/processes/hydrate.ts";
import type {
  ProcessHandleType,
  ServerMetaType,
  ServerProcessType,
} from "@/types/application/server-process.type.ts";

export const serverProcesses = shallowRef<Array<ServerProcessType>>([]);

export async function declareServerProcesses(): Promise<void> {
  const servers: Array<ServerProcessType> = [];

  await rehydrateProcesses(handle => {
    if (handle.kind !== "extension-server") {
      return;
    }

    const meta = handle.meta as ServerMetaType;

    servers.push(hydrate(handle as ProcessHandleType<ServerMetaType>));

    return {
      "onExit": (): void => {
        serverProcesses.value = serverProcesses.value.filter(item => item.name !== meta.name);
      },
      "onOutput": (line, stream): void => (stream === "stdout" ? log.debug : log.error)(
        __PRE_BUNDLED_FILENAME__, "txiki server output:" + "\n", line,
      ),
    };
  });

  serverProcesses.value = servers;
}
