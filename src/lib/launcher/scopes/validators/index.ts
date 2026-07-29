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

import {
  ensureMinecraftDirectory,
} from "@/lib/launcher/scopes/validators/ensure-minecraft-directory.ts";
import {
  ensurePatchDirectories,
} from "@/lib/launcher/scopes/validators/ensure-patch-directories.ts";
import {
  initializeAssetsDirectories,
} from "@/lib/launcher/scopes/validators/initialize-assets-directories.ts";
import {
  initializeShortHashDirectories,
} from "@/lib/launcher/scopes/validators/initialize-short-hash-directories.ts";
import {
  shallowlyValidateLibrary,
} from "@/lib/launcher/scopes/validators/shallowly-validate-library.ts";
import { shallowlyValidateMeta } from "@/lib/launcher/scopes/validators/shallowly-validate-meta.ts";

export default {
  ensureMinecraftDirectory,
  ensurePatchDirectories,
  initializeAssetsDirectories,
  initializeShortHashDirectories,
  shallowlyValidateLibrary,
  shallowlyValidateMeta,
} as const;
