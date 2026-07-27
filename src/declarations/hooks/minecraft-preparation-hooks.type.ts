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
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export type MinecraftPreparationHooksType = {

  /**
   * Executed in the very beginning of the instance launch
   */
  "onPreLaunchInformation": {

    /**
     * Executes 'sync'-only functions before any information reads.
     *
     * @param input - an object that has the 'statuses' and 'instanceId' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'PreLaunchInformationType | false' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      { "statuses": LauncherStatusesType; "instanceId": string },
    PreLaunchInformationType | false,
    "non-promise"
    >;

    /**
     * Executes 'sync'-only functions after all necessary information
     * was read and validated. If the validation fails, these hooks will not fire.
     *
     * @param input - an object that has the 'PreLaunchInformationType | false' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'PreLaunchInformationType | false' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
    PreLaunchInformationType | false,
    PreLaunchInformationType | false,
    "non-promise"
    >;
  };

  /**
   * Executed on libraries and natives parsing
   */
  "onLibrariesParsing": {

    /**
     * Executes 'sync'-only functions before any actions.
     *
     * @param input - an object that has the 'necessaries' and 'libraries' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'LibraryArtifactsType' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "libraries"  : Array<SpecificPatchLibraryType>;
      },
      Array<MappedArtifactType>,
      "non-promise"
    >;

    /**
     * Executes 'sync'-only functions after all libraries and natives are parsed.
     *
     * @param input - an object that has the 'necessaries', 'unparsed',
     * and 'parsed' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'LibraryArtifactsType' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "unparsed"   : Array<SpecificPatchLibraryType>;
        "parsed"     : Array<MappedArtifactType>;
      },
      Array<MappedArtifactType>,
      "non-promise"
    >;
  };

  /**
   * Executed on version meta get
   */
  "onVersionMeta": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'PreLaunchInformationType' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'SpecificPatchMetaType | false' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      PreLaunchInformationType,
    SpecificPatchMetaType | false
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft version meta
     * was read and validated. If the validation fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries' and 'minecraftVersionMeta' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'SpecificPatchMetaType | false' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "necessaries"         : PreLaunchInformationType;
        "minecraftVersionMeta": SpecificPatchMetaType | false;
      },
    SpecificPatchMetaType | false
    >;
  };

  /**
   * Executed on minecraft assets downloading/verifying
   */
  "onMinecraftAssetsGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries' and 'versionMeta' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a boolean (where 'true' is success and 'false' is fail)
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
      boolean
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft version meta
     * was read and validated. If the validation fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries' and 'versionMeta' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - a boolean (where 'true' is success and 'false' is fail)
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "versionMeta": SpecificPatchMetaType;
      },
      boolean
    >;
  };

  /**
   * Executed on prism launcher patches downloading/verifying
   */
  "onMinecraftPatchesGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries' and 'versionMeta' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'LibraryArtifactsType' type
     * or 'false' in case of a fail
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
    Array<MappedArtifactType> | false
    >;

    /**
     * Executes 'async' or 'sync' functions after the prism launcher patches
     * were handled. If the handling fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries', 'results',
     * and 'versionMeta' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'LibraryArtifactsType' type
     * or 'false' in case of a fail
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "results"    : Array<MappedArtifactType>;
        "versionMeta": SpecificPatchMetaType;
      },
    Array<MappedArtifactType> | false
    >;
  };

  /**
   * Executed on minecraft main jar downloading/verifying
   */
  "onMinecraftClientGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries', 'client',
     * and 'versionMeta' fields
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
        "necessaries": PreLaunchInformationType;
        "client"     : MappedArtifactType;
        "versionMeta": SpecificPatchMetaType;
      },
      void
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft main jar
     * was downloaded/validated. If the download/validation fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries', 'client',
     * and 'versionMeta' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "client"     : MappedArtifactType;
        "versionMeta": SpecificPatchMetaType;
      },
      "nothing"
    >;
  };

  /**
   * Executed on minecraft logging downloading/verifying
   */
  "onMinecraftLoggingGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries', 'logging',
     * and 'versionMeta' fields
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
        "necessaries": PreLaunchInformationType;
        "logging"    : MappedArtifactType & {
          "argument": string;
        };
        "versionMeta": SpecificPatchMetaType;
      },
      void
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft logging config
     * was downloaded/verified. If the download/verification fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries', 'logging',
     * and 'versionMeta' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "logging"    : MappedArtifactType & {
          "argument": string;
        };
        "versionMeta": SpecificPatchMetaType;
      },
      "nothing"
    >;
  };

  /**
   * Executed on minecraft libraries downloading/verifying
   */
  "onMinecraftLibrariesGet": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries', 'libraries',
     * 'natives', and 'versionMeta' fields
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
        "necessaries": PreLaunchInformationType;
        "libraries"  : Array<MappedArtifactType>;
        "natives"    : Array<MappedArtifactType>;
        "versionMeta": SpecificPatchMetaType;
      },
      void
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft libraries were
     * downloaded/verified. If the download/verification fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries', 'libraries',
     * 'natives', and 'versionMeta' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "libraries"  : Array<MappedArtifactType>;
        "natives"    : Array<MappedArtifactType>;
        "versionMeta": SpecificPatchMetaType;
      },
      "nothing"
    >;
  };

  /**
   * Executed on minecraft natives extraction
   */
  "onNativesExtract": {

    /**
     * Executes 'async' or 'sync' functions before any actions.
     *
     * @param input - an object that has the 'necessaries' and 'paths' fields
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
        "necessaries": PreLaunchInformationType;
        "paths"      : Array<string>;
      },
      void
    >;

    /**
     * Executes 'async' or 'sync' functions after the minecraft libraries were
     * downloaded/verified. If the download/verification fails, these hooks will not fire.
     *
     * @param input - an object that has the 'necessaries' and 'paths' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      {
        "necessaries": PreLaunchInformationType;
        "paths"      : Array<string>;
      },
      "nothing"
    >;
  };
};
