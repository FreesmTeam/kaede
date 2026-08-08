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
  storedInstance: GlobalStatesType["pages"]["add-instance"]["instance"] | undefined,
  minecraft: GlobalStatesType["minecraft"],
): Required<GlobalStatesType["pages"]["add-instance"]["instance"]> {
  if (!storedInstance) {
    return {
      "icon"         : minecraft.icon,
      "name"         : DefaultInstanceSettings.name,
      "entry"        : DefaultInstanceSettings.entry,
      "checksum"     : DefaultInstanceSettings.checksum,
      "groups"       : [...DefaultInstanceSettings.groups],
      "javaBinary"   : minecraft.javaBinary,
      "windowHeight" : minecraft.windowHeight,
      "windowWidth"  : minecraft.windowWidth,
      "patchVersions": { "net.minecraft": "1.16.5" },
      "add"          : {

        /*
         * We need to be extremely careful not to write into
         * the references of these arrays in 'DefaultGlobalStatesPagesStates'.
         *
         * Basically, on input, we should detach the arrays while on no input
         * the rendered arguments list should be attached to global states
         * so that the user will se new changes he makes in global states
         */
        "jvmArguments" : minecraft.add.jvmArguments,
        "gameArguments": minecraft.add.gameArguments,
      },
      "remove": {
        // We do not care about these as they are not changeable through UI (I am lazy)
        "jvmArguments" : [...minecraft.remove.jvmArguments],
        "gameArguments": [...minecraft.remove.gameArguments],
      },
    };
  }

  return storedInstance;
}
