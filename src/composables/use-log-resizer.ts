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

import type { TemplateRef } from "vue";

import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";

const toggleSection = (section: "time" | "level" | "target" | "message"): void => {
  globalStates.logs.partsShown[section] = !globalStates.logs.partsShown[section];
};

export function useLogResizer(
  characterElement: TemplateRef<HTMLDivElement>,
): {
  "resizeSection": (event: PointerEvent, section: "time" | "level" | "target") => void;
  "toggleSection": (section: "time" | "level" | "target" | "message") => void;
} {
  const resizeSection = (event: PointerEvent, section: "time" | "level" | "target"): void => {
    if (!characterElement.value) {
      return log.error(
        __PRE_BUNDLED_FILENAME__,
        "Couldn't get the character element node while resizing the section",
      );
    }

    // 'width' in 'onMount' is zero for some reason, so we get it here
    const width: number = characterElement.value.getBoundingClientRect().width;
    const start: number = event.clientX;
    const currentSize: number = globalStates.logs.partsSize[section];

    document.body.style.cursor = "col-resize";

    const onMove = (childEvent: PointerEvent): void => {
      const delta: number = childEvent.clientX - start;

      if (delta === 0) {
        return;
      }

      const absolute: number = Math.abs(delta);
      // I do not think cutting tab section titles is worth it
      const minimum: number = section.length;
      const newSize: number = Math.floor(absolute / width);

      globalStates.logs.partsSize[section] = delta < 0
        ? Math.max(currentSize - newSize, minimum)
        : Math.max(currentSize + newSize, minimum);
    };
    const cleanListeners = (): void => {
      document.body.style.cursor = "";

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanListeners);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanListeners);
  };

  return { resizeSection, toggleSection };
}
