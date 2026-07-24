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

import { computed, type ComputedRef } from "vue";

import General from "@/lib/general";
import { globalStates } from "@/states/global.ts";

export function useConfigColors(): {
  readonly "styles": ComputedRef<ReturnType<typeof General.getSidebarInnerStyles>>;
} {
  const styles = computed(
    (): ReturnType<typeof General.getSidebarInnerStyles> => (
      General.getSidebarInnerStyles(
        globalStates?.layout?.sidebar?.background,
        globalStates?.layout?.sidebar?.color,
        globalStates?.layout?.sidebar?.blur,
      )
    ),
  );

  return { styles };
}
