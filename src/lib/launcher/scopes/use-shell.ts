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

// import { Child, Command, makePowershellScript } from "tauri-plugin-shellx-api";

import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

/**
 * Unused as of now
 */
export async function useShell({
  actualCommand,
  instanceId,
  necessaries,
  onInput,
}: {
  "actualCommand": {
    "applet"   : string;
    "java"     : string;
    "arguments": string;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "onInput"    : (line: string) => void;
}): Promise<{
  "launchTask": Command<string>;
  "process"   : Child;
}> {
  const launchTask: Command<string> = necessaries.platform === "windows"
    ? makePowershellScript(
      `${actualCommand.java} ${actualCommand.arguments}`,
    )
    : Command.create(
      actualCommand.java,
      actualCommand.arguments,
      { "cwd": necessaries.directories.instance },
    );

  log.debug(__PRE_BUNDLED_FILENAME__, `Launching the '${instanceId}' instance`);
  const process: Child = await launchTask.spawn();

  log.debug(__PRE_BUNDLED_FILENAME__, `Adding listeners to the '${instanceId}' instance process`);
  launchTask.stdout.on("data", onInput);
  launchTask.stderr.on("data", onInput);

  return { launchTask, process };
}
