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

import { exists, writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Hashing from "@/lib/hashing";
import { log } from "@/lib/logging/log.ts";
import { serveFile } from "@/lib/txiki/serve-file.ts";
import type { ServerProcessType } from "@/types/application/server-process.type.ts";

export async function serveCode(
  name: string,
  code: string,
  port?: number,
): Promise<ServerProcessType | undefined> {
  const hash: string = await Hashing.hashStringCrypto(code);
  const shortHash: string = hash.slice(0, 7);
  const filePath: string = FileManager.join(
    FileManager.getBaseDirectory(),
    FileStructure.Folders.Extensions.Path,
    `tjs-${name}-${shortHash}.tjs`,
  );
  const alreadyExists: boolean = await exists(filePath);

  if (!alreadyExists) {
    try {
      log.debug(__PRE_BUNDLED_FILENAME__, "Writing code contents to host txiki");
      await writeTextFile(filePath, code);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Failed to create a code file to host txiki:",
        Errors.prettify(error),
      );

      return;
    }
  }

  return serveFile(name, filePath, port);
}
