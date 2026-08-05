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
import type { XboxTokenType } from "@/types/auth/microsoft-auth.type.ts";

/**
 * Authenticates the Microsoft access token with Xbox Live
 */
export async function authenticateWithXboxLive(
  microsoftAccessToken: string,
): Promise<XboxTokenType> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Authenticating with Xbox Live");
  const response: Response = await fetch(MicrosoftAuth.Endpoints.XboxLiveUser, {
    "method" : "POST",
    "headers": {
      "Content-Type": "application/json",
      "Accept"      : "application/json",
    },
    "body": JSON.stringify({
      "Properties": {
        "AuthMethod": "RPS",
        "SiteName"  : "user.auth.xboxlive.com",
        "RpsTicket" : `d=${microsoftAccessToken}`,
      },
      "RelyingParty": MicrosoftAuth.RelyingParties.XboxLive,
      "TokenType"   : "JWT",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `The Xbox Live authentication failed with the status ${response.status}`,
    );
  }

  const parsed: {
    "Token"        ?: string;
    "DisplayClaims"?: {
      "xui"?: Array<{ "uhs"?: string }>;
    };
  } = await response.json();

  const token: string | undefined = parsed?.Token;
  const userhash: string | undefined = parsed?.DisplayClaims?.xui?.[0]?.uhs;

  if (typeof token !== "string" || typeof userhash !== "string") {
    throw new TypeError("The Xbox Live response is missing the token or the userhash");
  }

  return {
    token,
    userhash,
  };
}
