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

import { cancel, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import { openUrl } from "@tauri-apps/plugin-opener";

import { MicrosoftAuth } from "@/constants/launcher.ts";
import { createPkcePair } from "@/lib/auth/scopes/create-pkce-pair.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";

const ResponseHtml: string = "<html><body>" +
  "<div>You can close this tab and return to Kaede Launcher now.</div>" +
  "<img alt='Tendou Arisu' src='https://static.wikitide.net/bluearchivewiki/thumb/b/b4/Arisu_%28Maid%29.png/399px-Arisu_%28Maid%29.png'>" +
  "</body></html>";

/**
 * @returns the authorization code with everything needed
 * to exchange it for tokens
 * @throws a human-readable 'Error' if the user cancels,
 * the timeout is reached, or the redirect is malformed
 */
export async function authorizeInteractively(): Promise<{
  "code"        : string;
  "redirectUri" : string;
  "codeVerifier": string;
}> {
  const { verifier, challenge, method } = await createPkcePair();
  const stateBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(16));
  const state: string = [...stateBytes]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  log.debug(__PRE_BUNDLED_FILENAME__, "Starting the localhost OAuth2 redirect server");
  const port: number = await start({ "response": ResponseHtml });
  const redirectUri: string = `http://localhost:${port}`;

  const authorizeUrl: URL = new URL(MicrosoftAuth.Endpoints.Authorize);

  authorizeUrl.searchParams.set("client_id", MicrosoftAuth.ClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", MicrosoftAuth.Scope);
  authorizeUrl.searchParams.set("prompt", "select_account");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", method);

  let unlisten: (() => void) | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    let resolveRedirect!: (url: string) => void;
    let rejectRedirect!: (error: Error) => void;

    const redirect: Promise<string> = new Promise((resolve, reject) => {
      resolveRedirect = resolve;
      rejectRedirect = reject;
    });

    timeoutId = setTimeout(() => {
      rejectRedirect(new Error(
        "Timed out waiting for the sign-in to finish in the browser",
      ));
    }, MicrosoftAuth.InteractiveTimeout);

    // Registered before the browser opens so the redirect cannot be missed
    unlisten = await onUrl(url => {
      resolveRedirect(url);
    });

    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `Opening the Microsoft sign-in page in the browser (port: ${port})`,
    );
    await openUrl(authorizeUrl.toString());

    /*
     * The plugin serves an unprotected localhost port, so the received
     * URL is untrusted until the 'state' is verified
     */
    const received: URL = new URL(await redirect);
    const receivedState: string | null = received.searchParams.get("state");
    const error: string | null = received.searchParams.get("error");
    const code: string | null = received.searchParams.get("code");

    if (error === "access_denied") {
      throw new Error("The sign-in was cancelled");
    }

    if (error !== null) {
      const description: string = received.searchParams.get("error_description")
        ?? "no description provided";

      throw new Error(`Microsoft returned the '${error}' error: ${description}`);
    }

    if (receivedState !== state) {
      throw new Error("The 'state' of the OAuth2 redirect does not match");
    }

    if (code === null || code.length === 0) {
      throw new Error("The OAuth2 redirect is missing the authorization code");
    }

    return {
      code,
      redirectUri,
      "codeVerifier": verifier,
    };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    unlisten?.();

    await cancel(port).catch((error: unknown) => {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        "Could not stop the localhost OAuth2 redirect server",
        "(it's ok if the redirect was already done):",
        Errors.prettify(error),
      );
    });
  }
}
