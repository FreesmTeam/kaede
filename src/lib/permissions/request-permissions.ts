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

import { handlePermission } from "@/lib/permissions/handle-permission.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export async function __requestPermissions(
  permissions: Array<PermissionType | string> | unknown,
  extension: string,
  request: (
    permission?: PermissionType | string,
    extension?: string,
    resolve?: (state: boolean) => void
  ) => void,
): Promise<Array<unknown>> {
  if (!Array.isArray(permissions)) {
    throw new TypeError("Permissions must be an array");
  }

  const currentPermissions = globalStates.extensions.permissions;
  const granted = [];

  for (const permission of permissions) {
    if (typeof permission !== "string") {
      throw new TypeError("A permission must be a string");
    }

    const hasPermission: boolean | undefined = currentPermissions?.[extension]?.[permission];

    if (hasPermission !== undefined) {
      granted.push(hasPermission
        ? handlePermission(permission, extension)
        : false);

      continue;
    }

    // This triggers a modal window with two buttons: 'allow' and 'disallow'
    const allowed = await new Promise((resolve: (state: boolean) => void) => {
      request(permission, extension, resolve);
    });

    if (currentPermissions[extension] === undefined) {
      currentPermissions[extension] = {};
    }

    granted.push(allowed
      ? handlePermission(permission, extension)
      : false);

    currentPermissions[extension][permission] = allowed;
  }

  // Clear the permissions request state by passing nothing
  request();

  return harden(granted);
}
