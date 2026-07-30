
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
import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type { LogParsedLineType } from "@/types/logging/log-parsing.type.ts";

const separator = " | ";
const separatorLength = separator.length;

export function parseLine(line: LogLineType): LogParsedLineType  {
  const parts: Array<string | undefined> = line.raw.split(separator);
  const [time, level, target] = parts;
  const looksStructured = !Number.isNaN(Number(line.raw[0]));

  if (!time || !level || !target || !looksStructured) {
    return {
      "kind"   : "plain",
      "text"   : line.raw,
      "offsets": { "full": [0, line.raw.length] },
    };
  }

  const message = parts.slice(3).join(separator);

  const timeEndIndex = line.raw.indexOf(separator);
  const levelEndIndex = line.raw.indexOf(separator, timeEndIndex + separatorLength);
  const targetEndIndex = line.raw.indexOf(separator, levelEndIndex + separatorLength);
  const messageStart = targetEndIndex + separatorLength;
  const messageEnd = line.raw.length;

  return {
    "kind"   : "structured",
    "index"  : line.index,
    "time"   : time,
    "level"  : level as LogLevelType,
    "target" : target,
    "message": message ?? "",
    "offsets": {
      "time"   : [0, timeEndIndex],
      "level"  : [timeEndIndex + separatorLength, levelEndIndex],
      "target" : [levelEndIndex + separatorLength, targetEndIndex],
      "message": [messageStart, messageEnd],
    },
  };
}
