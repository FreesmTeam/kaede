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

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function extractSavedFromPages(
  globalStates: GlobalStatesType | undefined,
): GlobalStatesType["pages"]["add-instance"]["instance"] {
  const storedInstance = globalStates?.pages?.["add-instance"]?.instance;

  if (!storedInstance) {
    return {
      "icon"        : globalStates?.minecraft?.icon,
      "name"        : DefaultInstanceSettings.name,
      "entry"       : DefaultInstanceSettings.entry,
      "checksum"    : DefaultInstanceSettings.checksum,
      "groups"      : [...DefaultInstanceSettings.groups],
      "javaBinary"  : globalStates?.minecraft?.javaBinary || DefaultInstanceSettings.javaBinary,
      "windowHeight": globalStates?.minecraft?.windowHeight ||
        DefaultInstanceSettings.windowHeight,
      "windowWidth"  : globalStates?.minecraft?.windowWidth || DefaultInstanceSettings.windowWidth,
      "patchVersions": { "net.minecraft": "1.16.5" },
      "add"          : {
        "jvmArguments": [...(
          globalStates?.minecraft?.add?.jvmArguments ??
          DefaultInstanceSettings.add?.jvmArguments ??
          []
        )],
        "gameArguments": [...(
          globalStates?.minecraft?.add?.gameArguments ??
          DefaultInstanceSettings.add?.gameArguments ??
          []
        )],
      },
    };
  }

  return storedInstance;
}
