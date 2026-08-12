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

/**
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

/*
 * A replica of the '@tauri-apps/plugin-http' backend for its "pull" body
 * protocol (2.5.9). The javascript side of the plugin works like this:
 *
 * 1. 'plugin:http|fetch' registers a request and returns its 'rid'
 * 2. 'plugin:http|fetch_send' performs the request and returns the response
 *    metadata (the body is not read yet)
 * 3. 'plugin:http|fetch_read_body' is called repeatedly and returns one
 *    body chunk per call with a flag byte appended: 0 means "a chunk",
 *    1 means "the body has ended"
 * 4. 'plugin:http|fetch_cancel' and 'plugin:http|fetch_cancel_body'
 *    abort the request and release the body stream
 *
 * Requests are performed with the browser 'fetch', so they succeed
 * only when the target host allows cross-origin requests
 */

type ClientConfigType = {
  "method" : string;
  "url"    : string;
  "headers": Array<[string, string]>;
  "data"   : Array<number> | null;
};

type PendingRequestType = {
  "config"    : ClientConfigType;
  "controller": AbortController;
  "reader"?   : ReadableStreamDefaultReader<Uint8Array>;
};

const pendingRequests: Map<number, PendingRequestType> = new Map;

let nextRequestId: number = 1;

export function registerHttpRequest(config: ClientConfigType): number {
  const rid: number = nextRequestId++;

  pendingRequests.set(rid, {
    config,
    "controller": new AbortController,
  });

  return rid;
}

export function cancelHttpRequest(rid: number): void {
  pendingRequests.get(rid)?.controller.abort();
  pendingRequests.delete(rid);
}

export async function sendHttpRequest(rid: number): Promise<{
  "status"    : number;
  "statusText": string;
  "url"       : string;
  "headers"   : Array<[string, string]>;
  "rid"       : number;
}> {
  const pending: PendingRequestType | undefined = pendingRequests.get(rid);

  if (!pending) {
    throw `There is no pending request with the '${rid}' identifier`;
  }

  const { config, controller } = pending;
  const response: Response = await fetch(config.url, {
    "method" : config.method,
    "headers": config.headers,
    "body"   : config.data === null ? undefined : new Uint8Array(config.data),
    "signal" : controller.signal,
  });

  pending.reader = response.body?.getReader();

  return {
    "status"    : response.status,
    "statusText": response.statusText,
    "url"       : response.url,
    "headers"   : [...response.headers.entries()],
    rid,
  };
}

export async function readHttpRequestBody(rid: number): Promise<Uint8Array> {
  const reader = pendingRequests.get(rid)?.reader;
  // The flag byte that closes the body stream on the plugin side
  const finished: Uint8Array = new Uint8Array([1]);

  if (!reader) {
    pendingRequests.delete(rid);

    return finished;
  }

  const { done, value } = await reader.read();

  if (done || !value) {
    pendingRequests.delete(rid);

    return finished;
  }

  const chunk: Uint8Array = new Uint8Array(value.length + 1);

  // The trailing flag byte is left as 0, meaning "one more chunk"
  chunk.set(value);

  return chunk;
}

export function cancelHttpRequestBody(rid: number): void {
  void pendingRequests
    .get(rid)
    ?.reader
    ?.cancel();
  pendingRequests.delete(rid);
}
