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

import { fetch } from "@tauri-apps/plugin-http";

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import type { MinecraftProfileType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function fetchSkinAsBase64(
  profile: MinecraftProfileType,
): Promise<AccountType["skin"]> {
  const activeSkin: MinecraftProfileType["skins"][number] | undefined = profile
    .skins
    .find(skin => (
      skin.state === "ACTIVE"
    )) ?? profile.skins[0];
  const variant: AccountType["skin"]["variant"] = activeSkin?.variant?.toLowerCase() === "slim"
    ? "slim"
    : "classic";

  if (!activeSkin || activeSkin.url.length === 0) {
    log.info(__PRE_BUNDLED_FILENAME__, "The profile has no skins");

    return {
      "id"     : "",
      "data"   : "",
      "url"    : "",
      "variant": "classic",
    };
  }

  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Downloading the active skin texture");
    const response: Response = await fetch(activeSkin.url);

    if (!response.ok) {
      throw new Error(`The skin texture request failed with the status ${response.status}`);
    }

    const blob: Blob = await response.blob();
    // 'readAsDataURL' encodes to base64
    const dataUrl: string = await new Promise<string>((resolve, reject) => {
      const reader: FileReader = new FileReader;

      reader.addEventListener("load", (): void => {
        resolve(String(reader.result));
      });
      reader.addEventListener("error", (): void => {
        reject(reader.error ?? new Error("Failed to read the skin texture"));
      });
      reader.readAsDataURL(blob);
    });
    const base64Part: string = dataUrl.slice(dataUrl.indexOf(",") + 1);

    return {
      "id"  : activeSkin.id,
      "data": base64Part,
      "url" : activeSkin.url,
      variant,
    };
  } catch (error: unknown) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "Failed to download the skin texture (continuing without it):",
      Errors.prettify(error),
    );

    return {
      "id"  : activeSkin.id,
      "data": "",
      "url" : activeSkin.url,
      variant,
    };
  }
}
