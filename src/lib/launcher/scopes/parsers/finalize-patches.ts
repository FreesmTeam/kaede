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

import { copyAndReverse } from "@/lib/collections/copy-array.ts";
import { parseLibraries } from "@/lib/launcher/scopes/parsers/parse-libraries.ts";
import { parseLogging } from "@/lib/launcher/scopes/parsers/parse-logging.ts";
import { parseMainJar } from "@/lib/launcher/scopes/parsers/parse-main-jar.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchLibraryType,
  SpecificPatchMetaType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

function addMavenFiles(
  necessaries: PreLaunchInformationType,
  patchUid: string,
  mavenFiles: Array<SpecificPatchLibraryType> | undefined,
  allMavenFiles: Array<MappedArtifactType>,
): void {
  if (!mavenFiles) {
    return;
  }

  const artifacts = parseLibraries({
    patchUid,
    necessaries,
    "libraries": mavenFiles,
    "isMaven"  : true,
  });

  allMavenFiles.push(...artifacts);
}

function addArtifactsToMap(
  necessaries: PreLaunchInformationType,
  patchUid: string,
  libraries: Array<SpecificPatchLibraryType> | undefined,
  map: Map<string, MappedArtifactType>,
  isFirst?: boolean,
): void {
  if (!libraries) {
    return;
  }

  const artifacts = parseLibraries({
    patchUid,
    necessaries,
    libraries,
    "isMaven": false,
  });

  for (const artifact of artifacts) {
    artifact.first = isFirst;

    const id = artifact.id;
    const stored: MappedArtifactType | undefined = map.get(id);

    // The 'library' and 'empty' ones should be included into classpaths
    if (stored?.status === "library" || stored?.status === "empty") {
      map.set(id, {
        ...artifact,

        /*
         * Preserve the already stored status.
         *
         * Seems like the 49.2.0 version of 'net.minecraftforge' has 'com.google.code.gson:gson'
         * in the 'mavenFiles' section, while 'net.minecraft' specifies that library
         * in the 'libraries' section, thus requiring it to be in the classpaths
         */
        "status": stored.status,
      });

      continue;
    }

    map.set(id, artifact);
  }
}

export function finalizePatches({
  patches,
  necessaries,
}: {
  "patches"    : Array<SpecificPatchMetaType>;
  "necessaries": PreLaunchInformationType;
}): FinalizedPatchType {
  /*
   * Initially, patches are sorted from parents to dependencies.
   * However, we need to go from dependencies to parents
   */
  const reversed: Array<SpecificPatchMetaType> = copyAndReverse(patches);

  /*
   * Previously, maven files and libraries shared the same unique artifacts map...
   * Turns out, NeoForge 1.21.2 does not work well with this approach
   * since it specifies 'asm' library both in 'mavenFiles' and 'libraries' with different versions.
   *
   * It also seems like we do not even need to check for ID duplicates of maven files;
   * instead, just download every maven file.
   */
  const foundMavenFiles: Array<MappedArtifactType> = [];
  // Patches might have overlapping artifacts with different versions
  const uniqueArtifacts = new Map<string, MappedArtifactType>;
  const built: FinalizedPatchType = {
    "+jvmArgs" : [],
    "+traits"  : [],
    "+tweakers": [],
    "artifacts": [],

    /*
     * Ancient versions do not have the 'mainClass' field,
     * so use their class as a default value
     */
    "mainClass"         : "net.minecraft.client.Minecraft",
    "minecraftArguments": "",
    "assetIndex"        : undefined,
    "type"              : undefined,
    "client"            : false,
    "logging"           : false,
  };

  for (const patch of reversed) {
    if (patch?.["+jvmArgs"]) {
      built["+jvmArgs"].push(...patch["+jvmArgs"]);
    }

    if (patch?.["+traits"]) {
      built["+traits"].push(...patch["+traits"]);
    }

    if (patch?.["+tweakers"]) {
      built["+tweakers"].push(...patch["+tweakers"]);
    }

    addMavenFiles(necessaries, patch.uid, patch.mavenFiles, foundMavenFiles);
    addArtifactsToMap(necessaries, patch.uid, patch.libraries, uniqueArtifacts);
    addArtifactsToMap(necessaries, patch.uid, patch["+libraries"], uniqueArtifacts, true);

    if (patch.mainClass) {
      built.mainClass = patch.mainClass;
    }

    if (patch.minecraftArguments) {
      built.minecraftArguments = patch.minecraftArguments;
    }

    if (patch.assetIndex) {
      built.assetIndex = patch.assetIndex;
    }

    if (patch.type) {
      built.type = patch.type;
    }

    const currentLogging = parseLogging({
      patch,
      necessaries,
    });
    const currentClient = parseMainJar({
      patch,
      necessaries,
    });

    // Overwrite the 'logging' field only if the parsed data is defined
    if (currentLogging) {
      built.logging = currentLogging;
    }

    // Overwrite the 'client' field only if the parsed data is defined
    if (currentClient) {
      built.client = currentClient;
    }
  }

  built.artifacts = [
    ...foundMavenFiles,
    ...uniqueArtifacts.values(),
  ];

  return built;
}
