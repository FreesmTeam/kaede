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

import type { PermissionType } from "@/types/extensions/permission.type.ts";

type MetadataType = {
  // Should be unique
  "id"        : string;
  "logo"      : string;
  "name"      : string;
  "type"      : "sandbox" | "unrestricted";
  "source"    : string;
  "version"   : string;
  "authors"   : Array<string>;
  // Use ISO 639-1 two-letter language codes
  "languages" : Array<string>;
  "categories": Array<string>;
} & Partial<{
  "description": string;
  "permissions": Array<PermissionType>;
  "enabled"    : boolean;
}>;

export type ExtensionType = {
  "id"      : string;
  "code"    : string;
  "metadata": MetadataType;
};
