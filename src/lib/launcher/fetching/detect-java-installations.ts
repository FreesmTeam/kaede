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

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import { javaStates } from "@/states/java.ts";
import type { JavaInstallationType } from "@/types/launcher/java-installation.type.ts";

export async function detectJavaInstallations(): Promise<void> {
  if (javaStates.status !== "idle") {
    return;
  }

  javaStates.status = "scanning";

  let installations: Array<JavaInstallationType>;

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Detecting installed Java runtimes");
    installations = await invoke("detect_java_installations");
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not detect installed Java runtimes:",
      Errors.prettify(error),
    );

    javaStates.status = "failed";

    return;
  }

  javaStates.installations = installations;
  javaStates.environment = installations.find(
    ({ source }) => source === "environment",
  ) ?? null;
  javaStates.status = "loaded";

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Detected ${installations.length} Java runtime(s)`,
  );
}
