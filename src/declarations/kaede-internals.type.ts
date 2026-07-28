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

import type { BrokerServerProcess } from "@/lib/capability-broker";
import type {
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStatesChangerType,
  InstanceStatesType,
} from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { AtAGlanceType } from "@/types/misc/at-a-glance.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export type KaedeInternalsSurfaceType<ApplicationType> = {
// Gets current application global states (use 'libs.GlobalStateHelpers#get')
  "getGlobalStates"     : () => GlobalStatesType;
  // Changes application global states (use 'libs.GlobalStateHelpers#change')
  "changeGlobalStates"  : GlobalStatesChangerType;
  // Gets current application instance states (use 'libs.Instances#get')
  "getInstanceStates"   : () => InstanceStatesType;
  // Changes application instance states (use 'libs.Instances#change')
  "changeInstanceStates": InstanceStatesChangerType;
  // Syncs the config file using global states
  "syncConfig"          : () => Promise<void>;
  // Platform-specific delimiter obtained by a single invoke of Tauri 'join'
  "joinDelimiter"       : string;
  // Launcher version
  "launcherVersion"     : string;
  // Config state before launcher initialization
  "initialConfig"       : ConfigType;
  // Accounts state before launcher initialization
  "temporaryAccounts"   : Array<AccountType>;
  // Translations state before launcher initialization
  "initialTranslations" : TranslationsType;
  // Instances metadata state before launcher initialization
  "initialInstances"    : InstanceStatesType;
  // Portable state
  "portable"            : boolean;
  // Base directory
  "baseDirectory"       : string;
  // This counter starts as 0 and increases by 1 each time the UI is reloaded via window#reload
  "launchCount"         : number;
  // Fixed line height used by the launcher log virtualizer.
  "logLineHeight"       : number;
  // A temporary storage for the 'At a Glance' widget
  "atAGlance"          ?: AtAGlanceType;
  // A Java major version (for example, 8, 11, or 17)
  "javaMajor"          ?: number;
  "appInstance"        ?: ApplicationType;

  /* Needed for browser environments (non-application) */
  "logsInBrowser"       : Array<string>;
  "indexedDB"          ?: IDBDatabase;

  /* Stores the server processes */
  "serverProcesses"     : Array<{
    "name" : string;
    "port" : number;
    "value": BrokerServerProcess;
  }>;
};
