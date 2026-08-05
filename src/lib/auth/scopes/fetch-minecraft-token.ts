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
import type {
  MinecraftTokenType,
  XboxTokenType,
} from "@/types/auth/microsoft-auth.type.ts";

/**
 * The JWT from Minecraft Services is valid for 24 hours,
 * and it is used for launching Minecraft
 */
export async function fetchMinecraftToken(
  xstsToken: XboxTokenType,
): Promise<MinecraftTokenType> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Signing in to Minecraft Services");
  const response: Response = await fetch(MicrosoftAuth.Endpoints.LoginWithXbox, {
    "method" : "POST",
    "headers": {
      "Content-Type": "application/json",
      "Accept"      : "application/json",
    },
    "body": JSON.stringify({
      "identityToken": `XBL3.0 x=${xstsToken.userhash};${xstsToken.token}`,
    }),
  });

  if (!response.ok) {
    throw new Error(

      /**
       * Note: 403 means the AppID was not approved
       */
      `The Minecraft Services sign-in failed with the status ${response.status}`,
    );
  }

  const parsed: {
    "access_token"?: string;
    "expires_in"  ?: number;
  } = await response.json();

  if (typeof parsed?.access_token !== "string" || parsed.access_token.length === 0) {
    throw new Error("The Minecraft Services response is missing the access token");
  }

  return {
    "accessToken": parsed.access_token,
    "expiresIn"  : typeof parsed.expires_in === "number"
      ? parsed.expires_in
      : 86_400,
  };
}
