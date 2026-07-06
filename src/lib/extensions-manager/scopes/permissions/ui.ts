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

import { createSafeDocument, type SafeDocument } from "ark-of-atrahasis";

import { GrantedScopes } from "@/constants/permissions.ts";
import { handleCssTheme } from "@/lib/extensions-manager/scopes/handle-css-theme.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export function handleBasicUIPermission({
  id,
}: {
  "id": string;
}): void {
  GrantedScopes[id].handleUIMount = (elementId: string): void => {
    const element: HTMLElement | null = document.getElementById(elementId);

    if (!element) {
      return log.error(
        __PRE_BUNDLED_FILENAME__,
        "Error while getting a root container for the extension",
      );
    }

    const gui: SafeDocument = createSafeDocument(element);

    GrantedScopes[id].gui = { ...gui };

    // These will be granted with other permissions
    delete GrantedScopes[id].gui.createAnchor;
    delete GrantedScopes[id].gui.createCanvas;
    delete GrantedScopes[id].gui.createImage;
    delete GrantedScopes[id].gui.createVideo;
    delete GrantedScopes[id].gui.createAudio;
    delete GrantedScopes[id].gui.createSource;
  };
}

export function handleUIStyle({
  id,
}: {
  "id": string;
}): void {
  GrantedScopes[id].handleCssTheme = (css: string): void => {
    handleCssTheme(css);
  };
}
