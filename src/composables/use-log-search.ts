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

import { watchDebounced } from "@vueuse/core";
import { computed, type ComputedRef, shallowReactive } from "vue";

import type { LogLineType } from "@/types/logging/log-line.type.ts";
import type {
  LogSearchComposableType, LogSearchMatchType, LogSearchStatusType,
} from "@/types/logging/log-searching.type.ts";

type Matcher = ((line: string) => Array<[number, number]>);

const regExpMatcher = (line: string, regex: RegExp): Array<[number, number]> => {
  const results: Array<[number, number]> = [];
  const matches = line.matchAll(regex);

  for (const match of matches) {
    if (match[0].length === 0) {
      // Avoid returning '[0, 0]'
      continue;
    }

    results.push([match.index, match.index + match[0].length]);
  }

  return results;
};
const rawMatcher = (line: string, matching: string, raw: string): Array<[number, number]> => {
  const results: Array<[number, number]> = [];
  const indexing = line;
  let position = indexing.indexOf(matching);

  while (position !== -1) {
    results.push([position, position + raw.length]);

    position = indexing.indexOf(matching, position + 1);
  }

  return results;
};

function compileMatcher(raw: string): {
  "matcher": Matcher;
  "valid"  : boolean;
} | undefined {
  if (!raw) {
    return;
  }

  try {
    // Try as regex first
    const regex: RegExp = new RegExp(raw, "gi");

    return {
      "matcher": (line: string) => regExpMatcher(line, regex),
      "valid"  : true,
    };
  } catch {
    // Fall back to literal indexOf
    const matching: string = raw;

    return {
      "matcher": (line: string) => rawMatcher(line, matching, raw),
      "valid"  : false,
    };
  }
}

export function useLogSearch(
  lines: ComputedRef<{ "list": Array<LogLineType> }>,
): LogSearchComposableType {
  const status = shallowReactive<LogSearchStatusType>({
    "searching": "",
    "valid"    : true,
    "active"   : false,
    "index"    : 0,
    "matches"  : [],
  });

  watchDebounced(
    () => [
      status.searching,
      lines.value.list.length,
    ],
    () => {
      status.matches = [];
      status.index = 0;

      const compiled = compileMatcher(status.searching);

      if (!compiled) {
        status.active = false;

        return;
      }

      const { matcher, valid } = compiled;

      status.valid = valid;
      status.active = true;

      const result: Array<LogSearchMatchType> = [];
      const list = lines.value.list;

      for (const [index, element] of list.entries()) {
        const ranges: Array<[number, number]> = matcher(element.raw);

        for (const [start, end] of ranges) {
          result.push({
            "lineIndex"  : index,
            "charStart"  : start,
            "charEnd"    : end,
            "globalIndex": result.length,
          });
        }
      }

      status.matches = result;
    },
    { "debounce": 200 },
  );

  const matchesByLine = computed(() => {
    const map = new Map<number, Array<LogSearchMatchType>>;

    for (const match of status.matches) {
      let array: Array<LogSearchMatchType> | undefined = map.get(match.lineIndex);

      if (!array) {
        array = [];

        map.set(match.lineIndex, array);
      }

      array.push(match);
    }

    return map;
  });

  function goTo(index: number): LogSearchMatchType | undefined {
    if (status.matches.length === 0) {
      return;
    }

    const bounded: number = index % status.matches.length;
    const nonNegativeIndex: number = (bounded + status.matches.length) % status.matches.length;

    status.index = nonNegativeIndex;

    return status.matches[nonNegativeIndex];
  }

  function next(): LogSearchMatchType | undefined {
    return goTo(status.index + 1);
  }

  function previous(): LogSearchMatchType | undefined {
    return goTo(status.index - 1);
  }

  function reset(): void {
    status.searching = "";
    status.valid = true;
    status.active = false;
    status.index = 0;
    status.matches = [];
  }

  return {
    status,
    matchesByLine,
    "utils": { goTo, next, previous, reset },
  };
}
