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
function validateRequestData(body: unknown, contentType: unknown): void {
  const isValidBody: boolean = (
    body === undefined ||
    typeof body === "string" ||
    ArrayBuffer.isView(body) ||
    body instanceof ArrayBuffer
  );

  if (!isValidBody) {
    throw new TypeError("The request body must be a string");
  }

  if (typeof contentType !== "string") {
    throw new TypeError("The request 'Content-Type' header must be a string");
  }

  switch (contentType.toLowerCase()) {
    // 'https://www.iana.org/assignments/media-types/media-types.xhtml'
    case "text/plain":
    case "image/gif":
    case "image/jpeg":
    case "image/png":
    case "video/mpeg":
    case "video/mp4":
    case "video/webm":
    case "application/json; charset=utf-8":
    case "application/json;charset=utf-8":
    case "application/json":
    case "application/zip":
    case "application/x-www-form-urlencoded":
    case "application/ogg":
    case "audio/mpeg": {
      break;
    }
    default: {
      throw new Error("The provided content type is not allowed");
    }
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
  "body"   ?: Uint8Array | ArrayBuffer | string;
}): void {
  guard(url, argument);
  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    `The '${id}' plugin made a ${label} fetch call with the next params`,
    { url, argument, method, body },
  ));
}

/**
 * The main idea here is to allow only known things and reject unknown,
 * even if something that was unknown is safe.
 *
 * @param id - a string that represents the plugin ID
 * @param scope - literals that represent the scope of the permission ('base::scope::argument')
 * @param argument - a string that represents the allowed URL
 */
export function handleInternetPermission({
  id,
  scope,
  argument,
}: {
  "id"       : string;
  "scope"    : "http-get" | "http-post";
  "argument"?: string;
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

          const response: Response = await fetch(url, { method, "redirect": "manual" });

          return buildSafeResponse(response);
        },
        "tauriFetch": async (url: string): Promise<RestrictedResponse> => {
          hook({ id, url, argument, method, "label": "Tauri" });

          const response: Response = await tauriFetch(url, { method, "redirect": "manual" });

          return buildSafeResponse(response);
        },
      });
    }
    case "http-post": {
      const method = "POST" as const;

      return harden({
        "webFetch": async (
          url: string,
          body: Uint8Array | ArrayBuffer | string | undefined,
          contentType: string = "text/plain",
        ): Promise<RestrictedResponse> => {
          validateRequestData(body, contentType);
          hook({ id, url, argument, method, "label": "Web", body });

          const response: Response = await fetch(url, {
            method,

            /*
             * We are using '@ts-ignore' instead of '@ts-expect-error' since uhm there are no errors
             */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore 'dts-bundle-generator' throws an error even though there are no errors????
            body,
            "redirect": "manual",
            "headers" : {
              "Content-Type": contentType,
            },
          });

          return buildSafeResponse(response);
        },
        "tauriFetch": async (
          url: string,
          body: Uint8Array | ArrayBuffer | string | undefined,
          contentType: string = "text/plain",
        ): Promise<RestrictedResponse> => {
          validateRequestData(body, contentType);
          hook({ id, url, argument, method, "label": "Tauri", body });

          const response: Response = await tauriFetch(url, {
            method,

            /*
             * We are using '@ts-ignore' instead of '@ts-expect-error' since uhm there are no errors
             */
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore 'dts-bundle-generator' throws an error even though there are no errors????
            body,
            "redirect": "manual",
            "headers" : {
              "Content-Type": contentType,
            },
          });

          return buildSafeResponse(response);
        },
      });
    }
  }
}
