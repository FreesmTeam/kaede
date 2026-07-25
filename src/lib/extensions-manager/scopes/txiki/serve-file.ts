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

import Errors from "@/lib/errors";
import { getFreePort } from "@/lib/extensions-manager/scopes/txiki/get-free-port.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import Processes from "@/lib/processes";
import type { ServerProcessType } from "@/types/application/server-process.type.ts";

export async function serveFile(
  name: string,
  filePath: string,
  port?: number,
): Promise<ServerProcessType | undefined> {
  const selectedPort: number = port ?? getFreePort();

  try {
    return Processes.spawnServer({
      name,
      "port"   : selectedPort,
      "program": { "type": "sidecar", "value": "txiki-server" },
      "args"   : ["serve", "--port", selectedPort.toString(), filePath],
    });
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to spawn a txiki server:",
      Errors.prettify(error),
    );
  }
}
