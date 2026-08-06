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

import { expect, test } from "bun:test";

import { decodeJwtPayload } from "@/lib/auth/scopes/decode-jwt-payload.ts";

function encodeAsJwtPayload(payload: unknown): string {
  // JWTs are base64url over the UTF-8 bytes, but 'btoa' is latin1-only
  const encoder = new TextEncoder;
  const bytes: Uint8Array = encoder.encode(JSON.stringify(payload));
  let binary: string = "";

  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  const base64: string = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `header.${base64}.signature`;
}

test("decodes a well-formed JWT payload", () => {
  const token: string = encodeAsJwtPayload({
    "exp" : 1_755_000_000,
    "xuid": "2535405290989773",
  });

  expect(decodeJwtPayload(token)).toStrictEqual({
    "exp" : 1_755_000_000,
    "xuid": "2535405290989773",
  });
});

test("gives valid output with base64url payloads that need padding", () => {
  for (const payload of [{ "a": 1 }, { "ab": 12 }, { "abc": 123 }, { "abcd": 1234 }]) {
    expect(decodeJwtPayload(encodeAsJwtPayload(payload))).toStrictEqual(payload);
  }
});

test("decodes non-ASCII payload values", () => {
  const token: string = encodeAsJwtPayload({ "name": "「カエデ」" });

  expect(decodeJwtPayload(token)).toStrictEqual({ "name": "「カエデ」" });
});

test("returns 'null' for non-JWT strings", () => {
  expect(decodeJwtPayload("")).toBeNull();
  expect(decodeJwtPayload("none")).toBeNull();
  expect(decodeJwtPayload("only.two")).toBeNull();
  expect(decodeJwtPayload("way.too.many.parts")).toBeNull();
});

test("returns 'null' for JWT strings without a JSON object payload", () => {
  expect(decodeJwtPayload("a.%%%.c")).toBeNull();
  expect(decodeJwtPayload(`a.${btoa("[1, 2, 3]")}.c`)).toBeNull();
  expect(decodeJwtPayload(`a.${btoa("42")}.c`)).toBeNull();
});
