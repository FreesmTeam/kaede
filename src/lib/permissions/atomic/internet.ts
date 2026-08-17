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

import "ses";

import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { log } from "@/lib/logging/log.ts";

type RestrictedBlob = {
  "size"       : number;
  "type"       : string;
  "arrayBuffer": () => Promise<ArrayBuffer>;
  "text"       : () => Promise<string>;
  "slice"      : (start?: number, end?: number, contentType?: string) => RestrictedBlob;
};
type RestrictedResponse = {
  "json"       : Response["json"];
  "text"       : Response["text"];
  "arrayBuffer": Response["arrayBuffer"];
  "blob"       : () => Promise<RestrictedBlob>;
  "ok"         : boolean;
  "redirected" : boolean;
  "status"     : number;
  "statusText" : string;
  "type"       : Response["type"];
  "url"        : string;
};

function guard(input: string | unknown, allowed: string): void {
  if (typeof input !== "string") {
    throw new TypeError("The input URL for the fetch should be a string");
  }

  const requestUrl = new URL(input);
  const scopeUrl = new URL(allowed);

  // Let the scope 'https://github.com/safeProfile' not allow 'https://github.com/safeProfileOhNotSoSafe'
  const scopePath: string = scopeUrl.pathname.endsWith("/")
    ? scopeUrl.pathname
    : scopeUrl.pathname + "/";
  const allowedOrigin: boolean = requestUrl.origin === scopeUrl.origin;
  const allowedPath: boolean =
    requestUrl.pathname === scopeUrl.pathname ||
    requestUrl.pathname.startsWith(scopePath);

  if (!allowedOrigin || !allowedPath) {
    throw new Error(`This request (${requestUrl.href}) goes out of your allowed scope`);
  }
}

function buildSafeBlob(blob: Blob): RestrictedBlob {
  return harden({
    "size"       : blob.size,
    "type"       : blob.type,
    "arrayBuffer": async () => {
      const buffer: ArrayBuffer = await blob.arrayBuffer();

      return harden(buffer.slice(0));
    },
    "text": async () => {
      const text: string = await blob.text();

      return text;
    },
    "slice": (start?: number, end?: number, contentType?: string): RestrictedBlob => {
      return buildSafeBlob(blob.slice(start, end, contentType));
    },
  });
}
function buildSafeResponse(response: Response): RestrictedResponse {
  return harden({
    "json": async () => {
      const json = await response.json();

      return harden(json);
    },
    "text": async () => {
      const text: string = await response.text();

      return text;
    },
    "arrayBuffer": async () => {
      const buffer: ArrayBuffer = await response.arrayBuffer();

      return harden(buffer.slice(0));
    },
    "blob": async (): Promise<RestrictedBlob> => {
      const blob: Blob = await response.blob();

      return buildSafeBlob(blob);
    },
    "ok"        : response.ok,
    "redirected": response.redirected,
    "status"    : response.status,
    "statusText": response.statusText,
    "type"      : response.type,
    "url"       : response.url,
  });
}

function hook({ id, url, argument, method, label, body }: {
  "id"      : string;
  "url"     : string | unknown;
  "argument": string;
  "method"  : "GET" | "POST";
  "label"   : "Web" | "Tauri";
  "body"   ?: string;
}): void {
  guard(url, argument);
  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    `The '${id}' plugin made a ${label} fetch call with the next params`,
    { url, argument, method, body },
  ));
}

export function handleInternetPermission({
  id,
  scope,
  argument,
}: {
  "id"       : string;
  "scope"    : "http-get" | "http-post";
  "argument"?: `http${string}` | "*" | string;
}): unknown {
  if (!argument) {
    throw new Error("Internet permissions must include a URL scope");
  }

  switch (scope) {
    case "http-get": {
      const method = "GET" as const;

      return harden({
        "webFetch": async (url: string): Promise<RestrictedResponse> => {
          hook({ id, url, argument, method, "label": "Web" });

          const response: Response = await fetch(url, { method });

          return buildSafeResponse(response);
        },
        "tauriFetch": async (url: string): Promise<RestrictedResponse> => {
          hook({ id, url, argument, method, "label": "Tauri" });

          const response: Response = await tauriFetch(url, { method });

          return buildSafeResponse(response);
        },
      });
    }
    case "http-post": {
      const method = "POST" as const;

      return harden({
        "webFetch": async (url: string, body: string | unknown): Promise<RestrictedResponse> => {
          if (typeof body !== "string") {
            throw new TypeError("The fetch body must be a string");
          }

          hook({ id, url, argument, method, "label": "Web", body });

          const response: Response = await fetch(url, { method, body });

          return buildSafeResponse(response);
        },
        "tauriFetch": async (url: string, body: string | unknown): Promise<RestrictedResponse> => {
          if (typeof body !== "string") {
            throw new TypeError("The fetch body must be a string");
          }

          hook({ id, url, argument, method, "label": "Tauri", body });

          const response: Response = await tauriFetch(url, { method, body });

          return buildSafeResponse(response);
        },
      });
    }
  }
}
