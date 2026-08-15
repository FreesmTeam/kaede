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

import { handleInternetPermission } from "@/lib/permissions/atomic/internet.ts";
import { handleLoggingPermission } from "@/lib/permissions/atomic/logging.ts";
import { handleTimePermission } from "@/lib/permissions/atomic/time.ts";
import {
  handleBasicUIPermission,
} from "@/lib/permissions/atomic/ui.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

type SplitPermission<T extends PermissionType> =
  T extends `${infer Base}::${infer Scope}`
    // The third argument is a dynamic value, e.g., 'internet::http-get::https://github.com'
    ? [Base, Scope, string]
    : never;

function split<Key extends PermissionType>(key: Key): SplitPermission<Key> {
  return key.split("::") as SplitPermission<Key>;
}

export function handlePermission<Key extends PermissionType>(permission: Key, id: string): unknown {
  const [base, scope, argument] = split(permission);

  if (!base || !scope) {
    throw new Error("The requested permission is invalid");
  }

  switch (base) {
    case "time": {
      // The 'scope' variable belongs to the correct 'base', gladly
      return handleTimePermission({ id, scope });
    }
    case "ui": {
      return handleBasicUIPermission({ id, scope });
    }
    case "internet": {
      return handleInternetPermission({ id, scope, argument });
    }
    case "log": {
      return handleLoggingPermission({ id, scope });
    }
    default: {
      return undefined;
    }
  }
}
