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

import { invoke } from "@tauri-apps/api/core";
import { stat } from "@tauri-apps/plugin-fs";

import { CustomPatches, Patches } from "@/constants/meta.ts";
import { log } from "@/lib/logging/log.ts";
import type {
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

async function describeArtifact({
  name,
  path,
  url,
  logPrefix,
}: {
  "name"     : string;
  "path"     : string;
  "url"      : string;
  "logPrefix": string;
}): Promise<SpecificPatchLibraryType | false> {
  try {
    // No one gives us hashes for these files so we get them ourselves
    const [hash, metadata] = await Promise.all([
      invoke<string>("hash_sha1_file", { path }),
      stat(path),
    ]);

    return {
      name,
      "downloads": {
        "artifact": {
          "sha1": hash,
          "size": metadata.size,
          url,
        },
      },
    };
  } catch (error) {
    log.error(logPrefix, `Failed to describe the '${name}' artifact: ${String(error)}`);

    return false;
  }
}

export async function generateOptiFinePatch({
  version,
  minecraftVersion,
  optiFineJarPath,
  optiFineUrl,
  launchWrapper,
  label,
}: {
  "version"         : string;
  "minecraftVersion": string;
  "optiFineJarPath" : string;
  "optiFineUrl"     : string;
  "launchWrapper"   : { "name": string; "path": string } | false;
  "label"           : string;
}): Promise<Record<string, unknown> | false> {
  const logPrefix: string = `${label}:${__PRE_BUNDLED_FILENAME__}`;

  const optiFine: SpecificPatchLibraryType | false = await describeArtifact({
    "name": `optifine:OptiFine:${version}`,
    "path": optiFineJarPath,
    "url" : optiFineUrl,
    logPrefix,
  });

  if (optiFine === false) {
    return false;
  }

  const libraries: Array<SpecificPatchLibraryType> = [];

  if (launchWrapper === false) {
    log.warn(logPrefix, "No bundled LaunchWrapper; falling back to the vanilla artifact");
    libraries.push({ "name": "net.minecraft:launchwrapper:1.12" });
  } else {
    const described: SpecificPatchLibraryType | false = await describeArtifact({
      "name": launchWrapper.name,
      "path": launchWrapper.path,

      // The jar was unpacked locally, so there is nothing to download it from
      "url": "",
      logPrefix,
    });

    if (described === false) {
      return false;
    }

    libraries.push({ ...described, "MMC-hint": "local" });
  }

  libraries.push(optiFine);

  log.info(logPrefix, `Generated the OptiFine patch for ${version}`);

  return {
    version,
    "formatVersion": 1,
    "name"         : "OptiFine",
    "uid"          : CustomPatches.OptiFine,
    "mainClass"    : "net.minecraft.launchwrapper.Launch",
    "+tweakers"    : ["optifine.OptiFineTweaker"],
    "+libraries"   : libraries,
    "requires"     : [
      {
        "uid"   : Patches.Minecraft,
        "equals": minecraftVersion,
      },
    ],
  };
}
