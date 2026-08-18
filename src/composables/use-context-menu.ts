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

import { useEventListener } from "@vueuse/core";
import { type Ref, ref } from "vue";

import { globalStates } from "@/states/global.ts";

export function useContextMenu(): {
  "contextMenu": Ref<{
    "opened": boolean;
    "x"     : number;
    "y"     : number;
  }>;
  "closeContextMenu": () => void;
  "showContextMenu" : (event: MouseEvent) => void;
} {
  const contextMenu = ref<{
    "opened": boolean;
    "x"     : number;
    "y"     : number;
  }>({ "opened": false, "x": 0, "y": 0 });

  function closeContextMenu(): void {
    contextMenu.value.opened = false;
  }
  function showContextMenu(event: MouseEvent): void {
    if (!globalStates.development.enableNativeContextMenu) {
      event.preventDefault();
    }

    const target = event.target as HTMLElement;

    if (
      target?.className?.includes?.("__context_menu__wrapper") ||
      target?.parentElement?.className?.includes?.("__context_menu__entry")
    ) {
      return;
    }

    if (
      target?.className?.includes?.("__context-menu-disable") ||
      target?.className?.includes?.("_rippleOverlay")
    ) {
      closeContextMenu();

      return;
    }

    contextMenu.value.opened = true;
    contextMenu.value.x = event.clientX;
    contextMenu.value.y = event.clientY;
  }

  useEventListener(window, "pointerdown", (event: PointerEvent) => {
    const target = event.target as HTMLElement;

    if (
      target?.className?.includes?.("__context_menu__") ||
      target?.parentElement?.className?.includes?.("__context_menu__")
    ) {
      return;
    }

    closeContextMenu();
  });

  return { contextMenu, showContextMenu, closeContextMenu };
}
