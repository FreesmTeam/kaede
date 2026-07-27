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

import { Host } from "@/lib/capability-broker/index.ts";

/*
 * Source - https://stackoverflow.com/a/51732778
 * Posted by Mahesh Bongani
 * Retrieved 2026-06-13, License - CC BY-SA 4.0
 */
export async function hashOfflineNickname(input: string): Promise<string> {
  const encoded: Uint8Array = (new TextEncoder).encode(`OfflinePlayer:${input}`);
  const hashed: string = await Host.hashes.md5(encoded);
  const bytes: Array<number> = [];

  for (let index = 0; index < hashed.length; index += 2) {
    const byte = Number.parseInt(
      hashed.slice(index, index + 2),
      16,
    );

    bytes.push(byte);
  }

  // Clear version
  bytes[6] = bytes[6] & 0x0F;
  // Set to version 3
  bytes[6] = bytes[6] | 0x30;
  // Clear variant
  bytes[8] = bytes[8] & 0x3F;
  // Set to IETF variant
  bytes[8] = bytes[8] | 0x80;

  return bytes
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}
