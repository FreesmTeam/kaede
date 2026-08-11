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

/*
 * Wails marshals a Go '[]byte' to a base64 string, so every binary payload
 * crosses the bridge encoded and is re-materialised here into the exact
 * shape the Tauri API contract promises the frontend
 */

/*
 * 'String#fromCharCode' is applied to slices rather than to the whole buffer:
 * spreading a multi-megabyte jar in one call overflows the argument stack
 */
const ConversionChunkSize: number = 0x80_00;

/**
 * Decodes a base64 payload returned by a Go service.
 *
 * @param encoded - The base64 text.
 *
 * @returns The decoded bytes.
 */
export function fromBase64(encoded: string): Uint8Array {
  const binary: string = atob(encoded);
  const bytes: Uint8Array = new Uint8Array(binary.length);

  /*
   * 'atob' answers with a binary string, so every unit is already a byte and
   * a code point can never differ from the code unit at the same position
   */
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }

  return bytes;
}

/**
 * Encodes bytes for a Go service.
 *
 * @param bytes - The payload to encode.
 *
 * @returns The base64 text.
 */
export function toBase64(bytes: Uint8Array): string {
  const parts: Array<string> = [];

  for (let index = 0; index < bytes.length; index += ConversionChunkSize) {
    const chunk: Uint8Array = bytes.subarray(index, index + ConversionChunkSize);

    parts.push(String.fromCodePoint(...chunk));
  }

  return btoa(parts.join(""));
}

/**
 * Normalizes whatever the Tauri API handed to 'invoke' as a request body.
 *
 * The file system plugin passes an 'ArrayBuffer' for some calls and a
 * 'Uint8Array' for others, and the hashing commands pass the array directly
 * as the payload instead of wrapping it in an object.
 *
 * @param payload - The raw invoke payload.
 *
 * @returns The payload as bytes.
 */
export function toBytes(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }

  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload);
  }

  if (Array.isArray(payload)) {
    return Uint8Array.from(payload as Array<number>);
  }

  return new Uint8Array;
}
