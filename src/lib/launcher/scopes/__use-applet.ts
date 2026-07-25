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

// 'import { Child, Command, makePowershellScript } from "tauri-plugin-shellx-api";'

/*
 * // import { log } from "@/lib/logging/scopes/log.ts";
 * import type {
 *   PreLaunchInformationType,
 * } from "@/types/launcher/meta/pre-launch-information.type.ts";
 */

/**
 * Unused as of now
 */

/*
 * // export async function useApplet({
 *   actualCommand,
 *   instanceId,
 *   necessaries,
 *   onInput,
 * }: {
 *   "actualCommand": {
 *     "applet"   : string;
 *     "java"     : string;
 *     "arguments": string;
 *   };
 *   "instanceId" : string;
 *   "necessaries": PreLaunchInformationType;
 *   "onInput"    : (line: string) => void;
 * }): Promise<{
 *   "launchTask": Command<string>;
 *   "process"   : Child;
 * }> {
 *   const launchTask: Command<string> = necessaries.platform === "windows"
 *     ? makePowershellScript(
 *       `javaw -jar ${actualCommand.applet} ${actualCommand.java} ${actualCommand.arguments}`,
 *     )
 *     : Command.create(
 *       "javaw",
 *       `-jar ${actualCommand.applet} ${actualCommand.java} ${actualCommand.arguments}`,
 *     );
 *
 *   log.debug(__PRE_BUNDLED_FILENAME__, `Launching the '${instanceId}' instance`);
 *   const process: Child = await launchTask.spawn();
 *
 *   log.debug(__PRE_BUNDLED_FILENAME__, "Creating a function to handle actual PID extraction");
 *   const handlePID = (line: string): void => {
 *     /*
 *      * TODO: handle the Minecraft instance killing more properly
 *      *
 *      * For some reason, the 'INFO'-leveled log messages in the Java applet
 *      * go into the 'stderr'. Another thing to note is that the provided by Tauri PID points
 *      * to what seems to be an intermediate process that no longer exists.
 *      *
 *      * To provide a way to kill the Minecraft instance, we need to handle these limitations,
 *      * so in the Java applet I used a workaround to get the actual PID:
 *      * refer to https://stackoverflow.com/a/7690178
 *      *
 *      * I also thought about writing to the process stdin with the keyword
 *      * for killing the Minecraft process, but it seems like only the 'stderr' and 'stdout'
 *      * are properly working here.
 *      *\/
 *     if (line.includes("__java_applet_pid_workaround_")) {
 *       log.debug(
 *         `${instanceId}:${__PRE_BUNDLED_FILENAME__}`,
 *         "Trying to extract an actual process PID",
 *       );
 *       const elements: Array<string> = line.split("_");
 *       const pidString: string | undefined = elements.pop();
 *
 *       if (!pidString) {
 *         log.error(
 *           __PRE_BUNDLED_FILENAME__,
 *           "The workaround for the java applet was found, but no PID was extracted.",
 *           `The actual line: ${line}`,
 *         );
 *
 *         return;
 *       }
 *
 *       const pid: number = Number(pidString);
 *
 *       if (Number.isNaN(pid)) {
 *         log.error(
 *           __PRE_BUNDLED_FILENAME__,
 *           "The workaround for the java applet was found, but the extracted PID is not a number.",
 *           `The extracted PID: ${pidString}; the actual line: ${line}`,
 *         );
 *
 *         return;
 *       }
 *
 *       log.info(__PRE_BUNDLED_FILENAME__, `Extracted the actual PID: ${pid}`);
 *
 *       // Overwrite the stored PID to the actual PID
 *       process.pid = pid;
 *
 *       /*
 *        * Calling 'includes' on every string line is expensive;
 *        * that is why we unregister a function aimed at getting PID
 *        * and instead register a specialized function that handles error logs
 *        *\/
 *       launchTask.stderr.off("data", handlePID);
 *       launchTask.stderr.on("data", onInput);
 *     }
 *   };
 *
 *   log
 *     .debug(__PRE_BUNDLED_FILENAME__, `Adding listeners to the '${instanceId}' instance process`);
 *   launchTask.stdout.on("data", onInput);
 *   launchTask.stderr.on("data", handlePID);
 *
 *   return { launchTask, process };
 * }
 */

export default { "unused": true };
