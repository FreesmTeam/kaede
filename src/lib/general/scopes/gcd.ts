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
 * Source - https://stackoverflow.com/a/17445322
 * Posted by Yannis, modified by community. See post 'Timeline' for change history
 * Retrieved 2026-04-06, License - CC BY-SA 3.0
 */
export function gcd(a: number, b: number): number {
  let first: number = Math.abs(Math.max(a, b));
  let second: number = Math.abs(Math.min(a, b));

  while (true) {
    if (second == 0) {
      return first;
    }

    first %= second;

    if (first == 0) {
      return second;
    }

    second %= first;
  }
}
