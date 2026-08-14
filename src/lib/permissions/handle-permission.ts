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

export function handlePermission(permission: PermissionType | string, id: string): unknown {
  const base: string = permission.split("::")[0];

  switch (base) {
    case "time": {
      return handleTimePermission({ id, permission });
    }
    case "ui-basic": {
      return handleBasicUIPermission({ id });
    }
    case "internet": {
      return handleInternetPermission({ id, permission });
    }
    case "write-to-log-file": {
      return handleLoggingPermission({ id });
    }
    default: {
      return undefined;
    }
  }
}
