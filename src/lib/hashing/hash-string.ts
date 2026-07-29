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
 * Source - https://stackoverflow.com/a/65239086
 * Posted by amirhe, modified by community. See post 'Timeline' for change history
 * Retrieved 2026-04-06, License - CC BY-SA 4.0
 */
export function hashString(input: string): number {
  let hash: number = 0;

  for (let index = 0; index < input.length; index++) {
    hash = Math.imul(31, hash) + (input.codePointAt(index) ?? 0);
  }

  return Math.trunc(hash);
}
