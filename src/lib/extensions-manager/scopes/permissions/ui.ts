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

export function handleBasicUIPermission({
  id,
}: {
  "id": string;
}): void {
  GrantedScopes[id].handleUIMount = (elementId: string): void => {
    const gui: SafeDocument = createSafeDocument(elementId);

    GrantedScopes[id].gui = {
      ...gui,
      // These will be granted with other permissions
      "createAnchor": undefined,
      "createCanvas": undefined,
      "createImage" : undefined,
      "createVideo" : undefined,
      "createAudio" : undefined,
      "createSource": undefined,
    };
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
