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

import General from "@/lib/general";
import type {
  SpecificPatchClassifierOSType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import FileManager from "@/lib/file-manager";

export function normalizeArtifactPath(artifact: string): {
  "directory" : string;
  "file"      : string;
  "classifier": SpecificPatchClassifierOSType | undefined;
  "id"        : string;
} {
  const prepared: Array<string> = artifact.split("@");
  const cleaned = prepared?.[0] ?? "";
  const extension = prepared?.[1] ?? "jar";
  const paths: Array<string> = cleaned.split(":");

  const group: string | undefined = paths?.[0];
  const name: string | undefined = paths?.[1];
  const version: string | undefined = paths?.[2];
  const classifier: string | undefined = paths?.[3];

  // The 'group', 'name', and 'version' elements should be always present
  if (!group || !name || !version) {
    const specifiedMessage: string =
      `(either group (${group}), name (${name}), or version (${version}) is missing)`;

    throw new Error(
      `Could not normalize artifact path ${specifiedMessage}`,
    );
  }

  const folders: Array<string> = [
    ...group.split("."),
    name,
    version,
  ];

  return {
    "directory": FileManager.join(...folders),
    "file"     : classifier === undefined
      ? `${name}-${version}.${extension}`
      : `${name}-${version}-${classifier}.${extension}`,
    "classifier": classifier as SpecificPatchClassifierOSType | undefined,
    // 'org.ow2.asm:asm-tree'
    "id"        : `${group}:${name}`,
  };
}
