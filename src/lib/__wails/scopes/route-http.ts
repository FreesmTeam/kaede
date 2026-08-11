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

import { callService } from "@/lib/__wails/scopes/call-service.ts";
import { fromBase64, toBase64 } from "@/lib/__wails/scopes/handle-binary.ts";

/*
 * The '@tauri-apps/plugin-http' backend, mapped onto the Go HTTP service.
 *
 * The plugin pulls a response body by calling 'fetch_read_body' over and over,
 * and reads a flag byte appended to every answer: 0 means "another chunk
 * follows", 1 means "the body has ended". That loop only ever existed to move
 * a body across the Tauri IPC boundary in pieces, so the Go side hands the
 * whole body over at once and the two-step handshake is completed here
 */

type ClientConfigType = {
  "method" : string;
  "url"    : string;
  "headers": Array<[string, string]>;
  "data"   : Array<number> | null;
};

// The identifiers whose body has already been handed to the plugin
const drainedBodies: Set<number> = new Set;

// A lone flag byte of 1 is how the plugin recognises the end of a body
function endOfBody(): Uint8Array {
  return new Uint8Array([1]);
}

export function registerRequest(config: ClientConfigType): Promise<unknown> {
  return callService(
    "HTTPService.Fetch",
    config.method ?? "GET",
    config.url,
    config.headers ?? [],
    // An empty string is how the service spells the plugin's 'data: null'
    config.data === null ? "" : toBase64(Uint8Array.from(config.data)),
  );
}

export function sendRequest(rid: number): Promise<unknown> {
  return callService("HTTPService.FetchSend", rid);
}

export async function cancelRequest(rid: number): Promise<unknown> {
  drainedBodies.delete(rid);

  return callService("HTTPService.FetchCancel", rid);
}

export async function readRequestBody(rid: number): Promise<Uint8Array> {
  /*
   * The second call for the same request is the plugin asking whether more
   * is coming. Nothing is, and the service has already dropped the entry
   */
  if (drainedBodies.has(rid)) {
    drainedBodies.delete(rid);

    return endOfBody();
  }

  const encoded = await callService("HTTPService.FetchReadBody", rid) as string | undefined;

  drainedBodies.add(rid);

  if (encoded === undefined || encoded === "") {
    const empty: Uint8Array = new Uint8Array(1);

    // The trailing flag byte is left as 0, so the plugin asks once more
    return empty;
  }

  const data: Uint8Array = fromBase64(encoded);
  const framed: Uint8Array = new Uint8Array(data.length + 1);

  framed.set(data);

  return framed;
}
