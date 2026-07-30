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

import type { ComputedRef } from "vue";

export type LogSearchMatchType = {
  // Index within the filtered lines array
  "lineIndex"  : number;
  // Character offset in the raw line text
  "charStart"  : number;
  "charEnd"    : number;
  // Position in the flat matches array
  "globalIndex": number;
};
export type LogSearchStatusType = {
  "searching": string;
  "valid"    : boolean;
  "active"   : boolean;
  "index"    : number;
  "matches"  : Array<LogSearchMatchType>;
};
export type LogSearchComposableType = {
  "status"       : LogSearchStatusType;
  "matchesByLine": ComputedRef<Map<number, LogSearchMatchType[]>>;
  "utils": {
    "goTo"    : (index: number) => LogSearchMatchType | undefined;
    "next"    : () => LogSearchMatchType | undefined;
    "previous": () => LogSearchMatchType | undefined;
    "reset"   : () => void;
  };
};
export type LogSearchState = "none" | "found" | "current";
