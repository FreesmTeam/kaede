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

import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  ArgumentAuthReplacementsType,
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export type LaunchArgumentHooksType = {

  /**
   * Executed on a shell command name get
   */
  "onJavaBinaryGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the shell command name
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
      },
      string
    >;
  };

  /**
   * Executed on JVM arguments get
   */
  "onJVMArgumentsGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', 'jvmArguments', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the JVM arguments
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "jvmArguments": Array<string>;
        "instanceId"  : string;
        "necessaries" : PreLaunchInformationType;
        "versionMeta" : SpecificPatchMetaType;
        "parsed"      : Array<MappedArtifactType>;
      },
      string
    >;

    /**
     * Executes 'async' or 'sync' functions after the JVM arguments were collected.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the JVM arguments
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "jvmArguments": Array<string>;
        "instanceId"  : string;
        "necessaries" : PreLaunchInformationType;
        "versionMeta" : SpecificPatchMetaType;
        "parsed"      : Array<MappedArtifactType>;
      },
      string
    >;
  };

  /**
   * Executed on classpaths get
   */
  "onClassPathsGet": {

    /**
     * Executes 'async' or 'sync' functions right after
     * acquiring merged library, native, and main jar paths.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', 'mergedPaths', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the argument string and classpaths string
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "mergedPaths": Array<string>;
        "instanceId" : string;
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
        "parsed"     : Array<MappedArtifactType>;
      },
      {
        "argument"  : string;
        "classPaths": string;
      }
    >;
  };

  /**
   * Executed on game arguments get
   */
  "onGameArgumentsGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the game arguments
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "instanceId" : string;
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
        "parsed"     : Array<MappedArtifactType>;
      },
      string
    >;

    /**
     * Executes 'async' or 'sync' functions after the MultiMC tweakers were added.
     *
     * @param input - an object that has the 'argumentsWithTweakers', 'instanceId',
     * 'necessaries', 'versionMeta', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the game arguments
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "argumentsWithTweakers": Array<string>;
        "instanceId"           : string;
        "necessaries"          : PreLaunchInformationType;
        "versionMeta"          : SpecificPatchMetaType;
        "parsed"               : Array<MappedArtifactType>;
      },
      string
    >;
  };

  /**
   * Executed on additional start arguments get.
   * For example, '/C javaw' for the 'cmd' command
   */
  "onAdditionalStartArgumentsGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'instanceId', 'necessaries',
     * 'versionMeta', 'javaBinary', and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents additional commands before JVM arguments
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "jvmArguments": Array<string>;
        "instanceId"  : string;
        "necessaries" : PreLaunchInformationType;
        "versionMeta" : SpecificPatchMetaType;
        "parsed"      : Array<MappedArtifactType>;
      },
      string
    >;
  };

  /**
   * Executed on argument placeholders replace in the launch command
   */
  "onLaunchArgumentsReplace": {

    /**
     * Executes 'sync'-only functions before making a regex replacements (no auth)
     *
     * @param input - an object that has the 'auth', 'replacements', 'builtLaunchArguments',
     * 'instanceId', 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the final launch command
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "auth": {
          "username": string;

          /**
           * Scary!
           */
          "token": string;
          "uuid" : string;
          "type" : string;
        };
        "replacements"        : ArgumentReplacementsType;
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
      string,
      "non-promise"
    >;

    /**
     * Executes 'sync'-only functions before making an auth regex replacements,
     * but after the non-auth regex replacements
     *
     * @param input - an object that has the 'auth', 'authReplacements',
     * 'replacements', 'builtLaunchArguments', 'instanceId',
     * 'necessaries', 'versionMeta', 'parsed', and 'javaBinary' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a string that represents the final launch command
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "auth": {
          "username": string;

          /**
           * Scary!
           */
          "token": string;
          "uuid" : string;
          "type" : string;
        };
        "replacements"        : ArgumentReplacementsType;
        "authReplacements"    : ArgumentAuthReplacementsType;
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
      string,
      "non-promise"
    >;
  };
};
