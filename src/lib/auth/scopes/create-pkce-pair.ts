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

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * PKCE (RFC 7636)
 */
export async function createPkcePair(): Promise<{
  "verifier" : string;
  "challenge": string;
  "method"   : "S256" | "plain";
}> {
  const randomBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));
  const verifier: string = toBase64Url(randomBytes);

  try {
    const digest: ArrayBuffer = await crypto.subtle.digest(
      "SHA-256",
      (new TextEncoder).encode(verifier),
    );

    return {
      verifier,
      "challenge": toBase64Url(new Uint8Array(digest)),
      "method"   : "S256",
    };
  } catch (error: unknown) {
    log.warn(
      __PRE_BUNDLED_FILENAME__,
      "An error occurred while hashing... Falling back to the 'plain' PKCE method:",
      Errors.prettify(error),
    );

    return {
      verifier,
      "challenge": verifier,
      "method"   : "plain",
    };
  }
}
