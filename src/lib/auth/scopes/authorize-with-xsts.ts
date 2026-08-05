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

/*
 * Known 'XErr' codes of the XSTS endpoint,
 * see https://minecraft.wiki/w/Microsoft_authentication
 */
const XstsErrors: Record<string, string> = {
  "2148916227": "The account is banned from Xbox",
  "2148916233": "The account doesn't have an Xbox account. Once you sign up for one " +
    "(or login through minecraft.net to create one), you can proceed with the login",
  "2148916235": "The account is from a country where Xbox Live is not available/banned",
  // South Korea
  "2148916236": "The account needs adult verification on Xbox page",
  // South Korea
  "2148916237": "The account needs adult verification on Xbox page",
  "2148916238": "The account is a child (under 18) and " +
    "cannot proceed unless the account is added to a Family by an adult",
  "2148916262": "Unknown error. See https://minecraft.wiki/w/Microsoft_authentication if there is additional information",
};

/**
 * Authorizes the Xbox Live user token with XSTS
 */
export async function authorizeWithXsts(
  xboxLiveToken: XboxTokenType,
): Promise<XboxTokenType> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Authorizing with XSTS");
  const response: Response = await fetch(MicrosoftAuth.Endpoints.Xsts, {
    "method" : "POST",
    "headers": {
      "Content-Type": "application/json",
      "Accept"      : "application/json",
    },
    "body": JSON.stringify({
      "Properties": {
        "SandboxId" : "RETAIL",
        "UserTokens": [xboxLiveToken.token],
      },
      "RelyingParty": MicrosoftAuth.RelyingParties.MinecraftServices,
      "TokenType"   : "JWT",
    }),
  });

  if (response.status === 401) {
    const parsed: { "XErr"?: number } = await response
      .json()
      .catch(() => ({}));
    const xErrorCode: string = (parsed?.XErr ?? "unknown").toString();

    throw new Error(
      XstsErrors[xErrorCode]
      ?? `The XSTS authorization was denied (XErr: ${xErrorCode})`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `The XSTS authorization failed with the status ${response.status}`,
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
    throw new TypeError("The XSTS response is missing the token or the userhash");
  }

  return {
    token,
    userhash,
  };
}
