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
 * @param token - a JWT string
 * @returns the parsed payload object or 'null' if 'token' is not a JWT
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts: Array<string> = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  // :wilted_rose:
  const base64: string = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");

  try {
    const decoded: string = atob(base64);

    // JWT payloads are ASCII, but profile names inside them might not be ASCII
    const bytes: Uint8Array = Uint8Array.from(decoded, character => (
      character.codePointAt(0) ?? 0
    ));
    const parsed: unknown = JSON.parse((new TextDecoder).decode(bytes));

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
