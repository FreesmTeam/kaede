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

export type UIColorsType = {
  "root"?: {
    // 'text.font'
    "fontFamily": string;
  };
  "overlay": {
    // 'background.color'
    "background"     : string;
    // 'background.blur'
    "backdropFilter"?: string;
  };
  "widget": {
    // 'widget.background'
    "background"     : string;
    // 'widget.textColor'
    "color"          : string;
    // 'widget.blur'
    "backdropFilter"?: string;
  };
};
