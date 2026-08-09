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

import { Patches } from "@/constants/meta.ts";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth/index.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

export function applyManifest({
  manifest,
  path,
}: {
  "manifest": MrpackManifestType | undefined;
  "path"    : string;
}): void {
  globalStates.pages["add-instance"].importedModpack = {
    "path"  : path,
    "name"  : manifest?.name ?? "Unknown",
    // We will fill in this field properly later (possibly)
    "loader": "net.minecraft" satisfies ExtendedPatchUIDType,
  };

  if (!manifest) {
    return log.info(
      __PRE_BUNDLED_FILENAME__,
      "No Modrinth manifest; treating the imported file as a plain zip:",
      path,
    );
  }

  const patchVersions = Modrinth.resolvePatchVersions(manifest.dependencies);
  const currentInstance = Instances.extractSavedFromPages(
    globalStates.pages?.["add-instance"]?.instance,
    globalStates.minecraft,
  );

  if (patchVersions === undefined) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      `'${manifest.name}' declares no Minecraft version; keeping the selected one`,
    );
  }

  if (!currentInstance) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No current instance returned");
  }

  globalStates.pages["add-instance"].instance = {
    ...currentInstance,
    "name"         : manifest.name || currentInstance.name,
    "patchVersions": patchVersions ?? currentInstance.patchVersions,
  };

  const loader = Object
    .keys(patchVersions ?? {})
    .find((uid): boolean => uid !== Patches.Minecraft);

  if (loader === undefined) {
    return log.error(__PRE_BUNDLED_FILENAME__, `The modloader of '${manifest.name}' is unknown`);
  }

  if (globalStates.pages["add-instance"].importedModpack) {
    globalStates.pages["add-instance"].importedModpack.loader = loader;
  }

  globalStates.pages["add-instance"].instanceVersionSearch = {
    "input": "",
    "patch": loader as ExtendedPatchUIDType,
  };
  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Got '${manifest.name}' (${manifest.versionId}) that indexes ${manifest.files.length} files`,
  );
}