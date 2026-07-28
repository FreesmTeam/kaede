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

import type { KaedeInternalsType } from "@/declarations.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export const GlobalInternals: KaedeInternalsType = {

  /* All these fields will be overwritten */
  "getGlobalStates"     : (): GlobalStatesType => ({} as GlobalStatesType),
  "changeGlobalStates"  : (): void => {},
  "getInstanceStates"   : (): InstanceStatesType => ({} as InstanceStatesType),
  "changeInstanceStates": (): void => {},
  "syncConfig"          : async (): Promise<void> => {},
  "joinDelimiter"       : "",
  "launcherVersion"     : "",
  "initialConfig"       : {} as ConfigType,
  "temporaryAccounts"   : [] as Array<AccountType>,
  "initialTranslations" : {} as TranslationsType,
  "initialInstances"    : {} as InstanceStatesType,
  "portable"            : false,
  "baseDirectory"       : "",
  "launchCount"         : 0,
  "logLineHeight"       : 20,
  "logsInBrowser"       : [],
  "serverProcesses"     : [],
};
