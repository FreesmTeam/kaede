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
 * Hashes bytes into a lowercase hex digest with the SubtleCrypto API.
 *
 * SubtleCrypto is available in secure contexts only,
 * but both 'localhost' previews and GitHub Pages are secure contexts
 */
export async function digestBytes(
  algorithm: "SHA-1" | "SHA-256",
  bytes: Uint8Array,
): Promise<string> {
  const digest: ArrayBuffer = await crypto.subtle.digest(
    algorithm,
    // Copy to detach the bytes from a possibly shared source buffer
    new Uint8Array(bytes),
  );

  return [...new Uint8Array(digest)]
    .map(byte => byte
      .toString(16)
      .padStart(2, "0"))
    .join("");
}
