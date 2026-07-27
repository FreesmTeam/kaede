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

import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { Host } from "@/lib/capability-broker";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export async function createInstance(
  currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
  uid: ExtendedPatchUIDType,
): Promise<void> {
  if (!currentInstance) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the instance is undefined",
    );
  }

  if (currentInstance.patchVersions[Patches.Minecraft] === undefined) {
    await Host.dialogs.message({
      "message": "Please, select the Minecraft version.",
      "title"  : "Instance creation",
      "kind"   : "error",
    });

    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the Minecraft patch version is undefined",
    );
  }

  if (currentInstance.patchVersions[uid] === undefined) {
    await Host.dialogs.message({
      "message": `Please, specify the ${PrettyPatchLabels[uid]} version.`,
      "title"  : "Instance creation",
      "kind"   : "error",
    });

    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the entry patch version is undefined",
    );
  }

  const randomDigits: number = Math.floor(Math.random() * 1000);
  const id: string =
    "instance_" + randomDigits + "_" +
    General.hashString(currentInstance.name).toString();

  log.debug(__PRE_BUNDLED_FILENAME__, "Creating an instance with the entry patch:", uid);

  await GlobalObject.libs.Instances.add(id, {
    ...currentInstance,
    "entry": uid,
  });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Successfully created an instance with the entry patch:",
    uid,
  );

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": undefined,
  });

  return GlobalStateHelpers.Pages.navigate(Routes.Library);
}
