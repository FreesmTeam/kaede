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

import { message } from "@tauri-apps/plugin-dialog";

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import Hashing from "@/lib/hashing";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export function create(
  currentInstance: GlobalStatesType["pages"]["add-instance"]["instance"],
  uid: ExtendedPatchUIDType,
): string | undefined {
  if (!currentInstance) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the instance is undefined",
    );

    return undefined;
  }

  if (currentInstance.patchVersions[Patches.Minecraft] === undefined) {
    void message(
      "Please, select the Minecraft version.",
      {
        "title": "Instance creation",
        "kind" : "error",
      },
    );

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the Minecraft patch version is undefined",
    );

    return undefined;
  }

  if (currentInstance.patchVersions[uid] === undefined) {
    void message(
      `Please, specify the ${PrettyPatchLabels[uid]} version.`,
      {
        "title": "Instance creation",
        "kind" : "error",
      },
    );

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the entry patch version is undefined",
    );

    return undefined;
  }

  const toAdd: Partial<Record<ExtendedPatchUIDType, string>> = {};

  if (uid === Patches.FabricLoader) {
    // 'net.fabricmc.intermediary' should equal a Minecraft version
    toAdd[Patches.FabricIntermediary] = currentInstance.patchVersions[Patches.Minecraft];
  }

  const randomDigits: number = Math.floor(Math.random() * 1000);
  const id: string =
    "instance_" + randomDigits + "_" +
    Hashing.hashString(currentInstance.name).toString();

  log.debug(__PRE_BUNDLED_FILENAME__, "Creating an instance with the entry patch:", uid);

  instanceStates[id] = {
    ...DefaultInstanceSettings,
    ...globalStates.minecraft,
    ...currentInstance,
    "patchVersions": {
      ...currentInstance.patchVersions,
      ...toAdd,
    },
    "entry": uid,
  };

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Successfully created an instance with the entry patch:",
    uid,
  );

  globalStates.pages["add-instance"].instance = undefined;
  globalStates.currentPage = Routes.Library;

  return id;
}
