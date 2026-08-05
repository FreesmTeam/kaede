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

import { watchEffect } from "vue";

import { CustomFontFamily } from "@/constants/application.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";

const StyleElementId = "__kaede-custom-font-face";

export function watchCustomFont(): () => void {
  const stop = watchEffect(() => {
    const font: string | null = globalStates.ui.text.font;

    const existing: HTMLElement | null = document.getElementById(StyleElementId);

    // A named font (or no font) does not need '@font-face' registration
    if (!General.isFontSourceUrl(font)) {
      existing?.remove?.();

      return;
    }

    const style: HTMLStyleElement = existing instanceof HTMLStyleElement
      ? existing
      : document.createElement("style");

    style.id = StyleElementId;
    style.textContent = "@font-face {"
      + ` font-family: "${CustomFontFamily}";`
      + ` src: url("${font}");`
      + " }";

    if (existing === null) {
      document.head.append(style);
    }

    log.debug(__PRE_BUNDLED_FILENAME__, `Registered custom font face from: ${font}`);
  });

  return (): void => {
    stop();
    document.getElementById(StyleElementId)?.remove?.();
  };
}
