
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

import { handleEvent } from "@/lib/extensions/sandbox/handle-event.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function onGlobalStateChange<Key extends keyof GlobalStatesType>(
  key: Key,
  value: unknown,
): void {
  switch (key) {
    case "pages": {
      const page = value as GlobalStatesType["currentPage"];

      handleEvent("routing", page);

      break;
    }
  }
}
