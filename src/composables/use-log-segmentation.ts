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

import type { ComputedRef, Ref } from "vue";
import { computed } from "vue";

import { LogKindColors, LogLevelColors } from "@/constants/application.ts";
import Logging from "@/lib/logging";
import { parseLine } from "@/lib/logging/parser.ts";
import { overlaySearch, tokenize } from "@/lib/logging/renderer.ts";
import type { LogLevelType } from "@/types/logging/log-level.type.ts";
import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type { LogRenderSegmentType } from "@/types/logging/log-render.type.ts";
import type {
  LogSearchMatchType,
  LogSearchStatusType,
} from "@/types/logging/log-searching.type.ts";

export function useLogSegmentation({
  filtered,
  matchesByLine,
  status,
  elements,
  position,
}: {
  "filtered"     : ComputedRef<{ "list": Array<LogLineType> }>;
  "matchesByLine": ComputedRef<Map<number, Array<LogSearchMatchType>>>;
  "status"       : LogSearchStatusType;
  "elements"     : ComputedRef<Array<number>>;
  "position"     : Ref<number>;
}): {
  "segments": ComputedRef<Array<Array<LogRenderSegmentType & {
    "gap"  : boolean;
    "class": string;
  }>>>;
} {
  function getSegments(filteredIndex: number): Array<LogRenderSegmentType> {
    const entry = filtered.value.list[filteredIndex];

    if (!entry) {
      return [];
    }

    const matches = matchesByLine.value.get(filteredIndex);
    const hasMatches = matches && matches.length > 0;

    const parsed = parseLine(entry);
    const tokens = tokenize(parsed);

    return hasMatches
      ? overlaySearch(tokens, matches, status.index)
      : tokens.map((rawToken, index) => ({
        "text" : rawToken.text,
        "kind" : rawToken.kind,
        "state": "none",
        index,
      }));
  }

  const segments = computed((): Array<Array<LogRenderSegmentType & {
    "gap"  : boolean;
    "class": string;
  }>> => {
    return elements.value.map(index => {
      return getSegments(position.value + index)
        // We need to carefully introduce the gap between log line sections...
        .map((currentSegment, currentIndex, currentArray) => {
          const nextSegment = currentArray[currentIndex + 1];
          let colorClass: string;

          switch (currentSegment.kind) {
            case "time": {
              colorClass = LogKindColors.time;

              break;
            }
            case "level": {
              colorClass = LogLevelColors[currentSegment.text.trim() as LogLevelType];

              break;
            }
            case "target": {
              colorClass = Logging.getLogTargetColor(currentSegment.text);

              break;
            }
            case "message": {
              colorClass = LogKindColors.message;

              break;
            }
          }

          return {
            "index": currentSegment.index,
            "state": currentSegment.state,
            "text" : currentSegment.text,
            "kind" : currentSegment.kind,
            // Is next section? If yes, then add a gap
            "gap"  : nextSegment !== undefined && currentSegment.kind !== nextSegment.kind,
            "class": colorClass,
          };
        });
    });
  });

  return { segments };
}
