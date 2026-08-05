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

import { MicrosoftAuth } from "@/constants/launcher.ts";
import { log } from "@/lib/logging/log.ts";
import type { MinecraftProfileType } from "@/types/auth/microsoft-auth.type.ts";

export async function fetchMinecraftProfile(
  minecraftAccessToken: string,
): Promise<MinecraftProfileType> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Fetching the Minecraft profile");
  const response: Response = await fetch(MicrosoftAuth.Endpoints.Profile, {
    "method" : "GET",
    "headers": {
      "Authorization": `Bearer ${minecraftAccessToken}`,
      "Accept"       : "application/json",
    },
  });

  if (response.status === 404) {
    throw new Error(
      "The Microsoft account does not own a Minecraft. " +
      "Or, if you are using Game Pass, the profile was not " +
      "created. Sign in to minecraft.net to fix the second issue",
    );
  }

  if (!response.ok) {
    throw new Error(
      `The Minecraft profile request failed with the status ${response.status}`,
    );
  }

  const parsed: {
    "id"   ?: string;
    "name" ?: string;
    "error"?: string;
    "skins"?: Array<{
      "id"     ?: string;
      "state"  ?: string;
      "url"    ?: string;
      "variant"?: string;
    }>;
  } = await response.json();

  if (parsed?.error === "NOT_FOUND") {
    throw new Error("The Microsoft account has no Minecraft profile");
  }

  if (typeof parsed?.id !== "string" || typeof parsed?.name !== "string") {
    throw new TypeError("The Minecraft profile response is missing the UUID or the name");
  }

  return {
    "uuid" : parsed.id,
    "name" : parsed.name,
    "skins": (parsed.skins ?? []).map(skin => ({
      "id"     : skin.id ?? "",
      "state"  : skin.state ?? "",
      "url"    : skin.url ?? "",
      "variant": skin.variant ?? "CLASSIC",
    })),
  };
}
