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

import type { KaedeNamespaceType } from "@/declarations.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";

/**
 * An object that contains everything that can be changed by extensions.
 *
 * The launcher heavily relies on this object in all kind of code places
 */
export const GlobalObject: KaedeNamespaceType = {
  "internals": GlobalInternals,
  "packages" : {},
  "constants": {} as KaedeNamespaceType["constants"],
  "libs"     : {} as KaedeNamespaceType["libs"],
  "hooks"    : {
    "onConfigFileGet"              : { "before": [], "after": [] },
    "onDefaultConfigGet"           : { "before": [] },
    "onPreLaunchInformation"       : { "before": [], "after": [] },
    "onVersionMeta"                : { "before": [], "after": [] },
    "onLibrariesParsing"           : { "before": [], "after": [] },
    "onMinecraftAssetsGet"         : { "before": [], "after": [] },
    "onMinecraftPatchesGet"        : { "before": [], "after": [] },
    "onMinecraftClientGet"         : { "before": [], "after": [] },
    "onMinecraftLoggingGet"        : { "before": [], "after": [] },
    "onMinecraftLibrariesGet"      : { "before": [], "after": [] },
    "onNativesExtract"             : { "before": [], "after": [] },
    "onJavaBinaryGet"              : { "before": [] },
    "onJVMArgumentsGet"            : { "before": [], "after": [] },
    "onClassPathsGet"              : { "before": [] },
    "onGameArgumentsGet"           : { "before": [], "after": [] },
    "onAdditionalStartArgumentsGet": { "before": [] },
    "onLaunchArgumentsReplace"     : { "before": [], "after": [] },
    "onMinecraftLaunch"            : { "before": [], "after": [] },
    "onMinecraftKill"              : { "before": [], "after": [] },
    "onMinecraftPatchResolve"      : { "before": [], "after": [] },
  },
};
