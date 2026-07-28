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

import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export type ConfigurationAndStateHooksType = {

  /**
   * Executed on the config retrieve
   */
  "onConfigFileGet": {

    /**
     * Executes 'async' or 'sync' functions before the config was read.
     *
     * @param input - a string that represents absolute pathname of the config file
     *                is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'ConfigType' type
     *                 in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<string, ConfigType>;

    /**
     * Executes 'async' or 'sync' functions after the config was read, parsed, and validated.
     *
     * @param input - an object that has the 'ConfigType' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'ConfigType' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * it may add properties to the passed config argument or do nothing.
     */
    "after": HookReturnType<ConfigType, ConfigType>;
  };

  /**
   * Executed on the default config retrieve
   */
  "onDefaultConfigGet": {

    /**
     * Executes 'async' or 'sync' functions before the default config was returned.
     *
     * No arguments.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'ConfigType' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<unknown, ConfigType>;
  };

  /**
   * Executed on the translations replacement in global states
   */
  "onTranslationsChange": {

    /**
     * Executes 'sync'-only functions before the 'translations' property
     * in the global states will change.
     *
     * @param input - an object that has the 'TranslationsType' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'TranslationsType' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<TranslationsType, TranslationsType, "non-promise">;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'translations' property in the global states has changed.
     *
     * @param input - an object that has the 'TranslationsType' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<TranslationsType, "nothing">;
  };

  /**
   * Executed on the 'layout' field replacement in global states
   */
  "onLayoutChange": {

    /**
     * Executes 'sync'-only functions before the 'layout' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["layout"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["layout"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["layout"],
      GlobalStatesType["layout"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'layout' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["layout"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["layout"], "nothing">;
  };

  /**
   * Executed on the 'pages' field replacement in global states
   */
  "onPagesChange": {

    /**
     * Executes 'sync'-only functions before the 'pages' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["pages"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["pages"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["pages"],
      GlobalStatesType["pages"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'pages' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["pages"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["pages"], "nothing">;
  };

  /**
   * Executed on the 'logs' field replacement in global states
   */
  "onLogsChange": {

    /**
     * Executes 'sync'-only functions before the 'logs' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["logs"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["logs"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["logs"],
      GlobalStatesType["logs"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'logs' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["logs"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["logs"], "nothing">;
  };

  /**
   * Executed on the 'sidebarItems' field replacement in global states
   */
  "onSidebarItemsChange": {

    /**
     * Executes 'sync'-only functions before the 'sidebarItems' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["sidebarItems"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["sidebarItems"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["sidebarItems"],
      GlobalStatesType["sidebarItems"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'sidebarItems' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["sidebarItems"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["sidebarItems"], "nothing">;
  };

  /**
   * Executed on the 'contextMenuItems' field replacement in global states
   */
  "onContextMenuItemsChange": {

    /**
     * Executes 'sync'-only functions before the 'contextMenuItems' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["contextMenuItems"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["contextMenuItems"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["contextMenuItems"],
      GlobalStatesType["contextMenuItems"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'contextMenuItems' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["contextMenuItems"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["contextMenuItems"], "nothing">;
  };

  /**
   * Executed on the 'development' field replacement in global states
   */
  "onDevelopmentChange": {

    /**
     * Executes 'sync'-only functions before the 'development' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["development"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["development"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["development"],
      GlobalStatesType["development"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'development' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["development"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["development"], "nothing">;
  };

  /**
   * Executed on the 'misc' field replacement in global states
   */
  "onMiscChange": {

    /**
     * Executes 'sync'-only functions before the 'misc' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["misc"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["misc"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["misc"],
      GlobalStatesType["misc"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'misc' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["misc"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["misc"], "nothing">;
  };

  /**
   * Executed on the 'minecraft' field replacement in global states
   */
  "onMinecraftChange": {

    /**
     * Executes 'sync'-only functions before the 'minecraft' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["minecraft"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["minecraft"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["minecraft"],
      GlobalStatesType["minecraft"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'minecraft' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["minecraft"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["minecraft"], "nothing">;
  };

  /**
   * Executed on the 'extensions' field replacement in global states
   */
  "onExtensionsChange": {

    /**
     * Executes 'sync'-only functions before the 'extensions' property
     * in the global states will change.
     *
     * @param input - an object that has the 'GlobalStatesType["extensions"]' type
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'GlobalStatesType["extensions"]' type
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      GlobalStatesType["extensions"],
      GlobalStatesType["extensions"],
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the 'extensions' property in the global states has changed.
     *
     * @param input - an object that has the 'GlobalStatesType["extensions"]' type
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<GlobalStatesType["extensions"], "nothing">;
  };

  /**
   * Executed on the field addition/overwrite/deletion in instance states
   */
  "onInstanceChange": {

    /**
     * Executes 'sync'-only functions before the provided field
     * in the instance states will change.
     *
     * @param input - an object that has the 'key' and 'value' fields
     * is passed as the argument.
     *
     * If the hook returns a 'stop' status,
     * it should also return:
     * @param output - an object that has the 'key' and 'value' fields
     * in the 'response' field.
     *
     * If the hook returns a 'continue' status,
     * code execution will continue as if that hook did not exist.
     */
    "before": HookReturnType<
      { "key": string; "value": InstanceStateType },
      { "key": string; "value": InstanceStateType },
      "non-promise"
    >;

    /**
     * Executes 'async' or 'sync' functions on the next Vue tick,
     * after the provided field in the instance states has changed.
     *
     * @param input - an object that has the 'key' and 'value' fields
     * is passed as the argument.
     *
     * Hook should not return anything since the response will not be read.
     */
    "after": HookReturnType<
      { "key": string; "value": InstanceStateType },
      "nothing"
    >;
  };
};
