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

import { globalStates } from "@/states/global.ts";
import type { UIColorsType } from "@/types/ui/ui-colors.type.ts";

export function useConfigColors(): {
  "styles": ComputedRef<UIColorsType>;
} {
  const styles = computed((): UIColorsType => {
    const current: UIColorsType = {
      "overlay": {
        "background": globalStates.ui.background.color || "rgb(17, 17, 17)",
      },
      "widget": {
        "background": globalStates.ui.widget.background || "rgb(10, 10, 10)",
        "color"     : globalStates.ui.widget.textColor || "rgb(255, 255, 255)",
      },
    };

    if (globalStates.ui.text.font !== null) {
      current.root = {
        "fontFamily": globalStates.ui.text.font,
      };
    }

    if (globalStates.ui.background.blur !== null) {
      current.overlay.backdropFilter = `blur(${globalStates.ui.background.blur}px)`;
    }

    if (globalStates.ui.widget.blur !== null) {
      current.widget.backdropFilter = `blur(${globalStates.ui.widget.blur}px)`;
    }

    return current;
  });

  return { styles };
}
