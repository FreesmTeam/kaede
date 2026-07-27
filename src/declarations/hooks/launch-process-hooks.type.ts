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

import type { BrokerProcess } from "@/lib/capability-broker";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export type LaunchProcessHooksType = {

  /**
   * Executed on minecraft instance launch
   */
  "onMinecraftLaunch": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'command', 'auth',
     * 'builtLaunchArguments', 'instanceId', 'necessaries',
     * 'parsed', 'versionMeta', and 'javaBinary' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a 'void'
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
      // [javaBinary, launchCommand]
        "command": [string, string];
        "auth"   : {
          "username": string;

          /**
           * Scary!
           */
          "token": string;
          "uuid" : string;
          "type" : string;
        };
        "builtLaunchArguments": {
          "toReplace" : string;
          "classPaths": string;
        };
        "instanceId" : string;
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
        "parsed"     : Array<MappedArtifactType>;
        "javaBinary" : string;
      },
      void
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft instance was launched.
     *
     * @param input - an object that has the 'process', 'command', 'auth',
     * 'builtLaunchArguments', 'instanceId', 'necessaries',
     * 'parsed', 'versionMeta', and 'javaBinary' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      {
        "process": BrokerProcess;
        // [javaBinary, launchCommand]
        "command": [string, string];
        "auth"   : {
          "username": string;

          /**
           * Scary!
           */
          "token": string;
          "uuid" : string;
          "type" : string;
        };
        "builtLaunchArguments": {
          "toReplace" : string;
          "classPaths": string;
        };
        "instanceId" : string;
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
        "parsed"     : Array<MappedArtifactType>;
        "javaBinary" : string;
      },
      "nothing"
    >;
  };

  /**
   * Executed on minecraft instance kill
   */
  "onMinecraftKill": {

    /**
     * Executes 'async' or 'sync' functions before the instance was killed.
     *
     * @param input - an object that has the 'pid' and 'kill' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a 'void'
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<BrokerProcess, void>;

    /**
     * Executes 'async' or 'sync' functions after the instance was killed.
     *
     * @param input - an instance process id number
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      number,
      "nothing"
    >;
  };
  "onMinecraftPatchResolve": {
    "before": [];
    "after" : [];
  };
};
