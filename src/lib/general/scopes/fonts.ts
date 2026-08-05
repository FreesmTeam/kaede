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
 * A picked font file arrives as a URL (a Tauri asset URL, or a remote one),
 * which cannot be used as a 'font-family' directly. We detect those values so
 * they can be registered through '@font-face' instead of naming a family
 */
export function isFontSourceUrl(font: string | null | undefined): boolean {
  if (!font) {
    return false;
  }

  return font.startsWith("http://") ||
    font.startsWith("https://") ||
    font.startsWith("blob:") ||
    font.startsWith("data:");
}
