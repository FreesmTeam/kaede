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

import { type ClientOptions, fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { log } from "@/lib/logging/log.ts";

function guard(input: RequestInfo | URL, scope: string): void {
  const scopeUrl = new URL(scope);
  const requestUrl = new URL(
    input instanceof Request ? input.url : input.toString(),
  );

  const scopePath = scopeUrl.pathname.endsWith("/")
    ? scopeUrl.pathname
    : scopeUrl.pathname + "/";

  if (
    requestUrl.origin !== scopeUrl.origin ||
    (
      requestUrl.pathname !== scopeUrl.pathname &&
      !requestUrl.pathname.startsWith(scopePath)
    )
  ) {
    throw new Error(`This request (${requestUrl.href}) goes out of your allowed scope`);
  }
}

export function handleInternetPermission({
  id,
  permission,
}: {
  "id"        : string;
  "permission": string;
}): unknown {
  const parts = permission.split("::");

  parts.shift();

  const scope = parts.join("::");

  if (!scope) {
    throw new Error("Internet permissions must include URL scope");
  }

  const wrappedWebFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    guard(input, scope);

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
      `The '${id}' plugin made a Web fetch call with the next params`,
      { input, init },
    ));

    return fetch(input, init);
  };
  const wrappedTauriFetch = async (
    input: URL | Request | string,
    init?: RequestInit & ClientOptions,
  ): Promise<Response> => {
    guard(input, scope);

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
      `The '${id}' plugin made a Tauri fetch call with the next params`,
      { input, init },
    ));

    return tauriFetch(input, init);
  };

  return harden({
    "webFetch"  : wrappedWebFetch,
    "tauriFetch": wrappedTauriFetch,
  });
}
