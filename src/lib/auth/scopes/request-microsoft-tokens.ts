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
import type { MicrosoftTokensType } from "@/types/auth/microsoft-auth.type.ts";

/**
 * First sign-in     - an authorization code
 * Non-first sign-in - a refresh token
 */
export async function requestMicrosoftTokens(grant: {
  "kind"        : "authorization-code";
  "code"        : string;
  "redirectUri" : string;
  "codeVerifier": string;
} | {
  "kind"        : "refresh-token";
  "refreshToken": string;
}): Promise<MicrosoftTokensType> {
  const body: URLSearchParams = new URLSearchParams({
    "client_id": MicrosoftAuth.ClientId,
    "scope"    : MicrosoftAuth.Scope,
  });

  if (grant.kind === "authorization-code") {
    body.set("grant_type", "authorization_code");
    body.set("code", grant.code);
    body.set("redirect_uri", grant.redirectUri);
    body.set("code_verifier", grant.codeVerifier);
  } else {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", grant.refreshToken);
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Requesting Microsoft tokens ('${grant.kind}' grant)`,
  );
  const response: Response = await fetch(MicrosoftAuth.Endpoints.Token, {
    "method" : "POST",
    "headers": {

      /*
       * The empty value makes 'Origin' header absent from the request.
       * Otherwise, the appended value is a WebView origin, which leads
       * to an error 'AADSTS90023'.
       *
       * This requires 'unsafe-headers' feature enabled for 'tauri-plugin-http'
       */
      "Origin"      : "",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    "body": body.toString(),
  });

  if (!response.ok) {
    /*
     * Errors are explained in the 'error' and 'error_description' fields.
     * The description starts with a code ('AADSTS'):
     * - AADSTS70000:   expired refresh token
     * - AADSTS9002327: redirect URI is registered as an SPA
     */
    const details: string = await response
      .json()
      .then((parsed: { "error"?: string; "error_description"?: string }) => {
        const error: string = parsed?.error ?? "unknown";
        const description: string = parsed?.error_description ?? "no description";

        return `${error}: ${description.slice(0, 256)}`;
      })
      .catch(() => "unknown");

    throw new Error(
      `The Microsoft token request failed with the status ${response.status} (${details})`,
    );
  }

  const parsed: {
    "access_token" ?: string;
    "refresh_token"?: string;
    "expires_in"   ?: number;
  } = await response.json();

  if (typeof parsed?.access_token !== "string" || parsed.access_token.length === 0) {
    throw new Error("The Microsoft token response is missing the access token");
  }

  if (typeof parsed?.refresh_token !== "string" || parsed.refresh_token.length === 0) {
    throw new Error(
      "The Microsoft token response is missing the refresh token. " +
      "Is the 'offline_access' scope present?",
    );
  }

  return {
    "accessToken" : parsed.access_token,
    "refreshToken": parsed.refresh_token,
    "expiresIn"   : typeof parsed.expires_in === "number"
      ? parsed.expires_in
      : 3600,
  };
}
