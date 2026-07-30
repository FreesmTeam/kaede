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

import type { LogLevelType } from "@/types/logging/log-level.type.ts";

export type LogStructuredLineType = {
  "kind"   : "structured";
  "index"  : number;
  "time"   : string;
  "level"  : LogLevelType;
  "target" : string;
  "message": string;
  // Raw string character offsets ('[start, end]') for each field
  "offsets": {
    "time"   : [number, number];
    "level"  : [number, number];
    "target" : [number, number];
    "message": [number, number];
  };
};
export type LogPlainLineType = {
  "kind"   : "plain";
  "text"   : string;
  "offsets": { "full": [number, number] };
};

export type LogParsedLineType = LogStructuredLineType | LogPlainLineType;
