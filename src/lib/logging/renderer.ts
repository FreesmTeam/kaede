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

import { globalStates } from "@/states/global.ts";
import type { LogParsedLineType } from "@/types/logging/log-parsing.type.ts";
import type { LogRenderSegmentType } from "@/types/logging/log-render.type.ts";
import type { LogSearchMatchType } from "@/types/logging/log-searching.type.ts";

type RawToken = {
  "text"       : string;
  "kind"       : LogRenderSegmentType["kind"];
  "rawStart"   : number;
  "rawEnd"     : number;
  "renderStart": number;
  "renderEnd"  : number;
};

export function tokenize(parsed: LogParsedLineType): Array<RawToken> {
  const partsShown = globalStates.logs.partsShown;

  if (parsed.kind === "plain") {
    return [{
      "text"       : parsed.text,
      "kind"       : "message",
      "rawStart"   : parsed.offsets.full[0],
      "rawEnd"     : parsed.offsets.full[1],
      "renderStart": 0,
      "renderEnd"  : parsed.text.length,
    }];
  }

  const tokens: Array<RawToken> = [];
  let renderCursor = 0;

  const push = (text: string, rawStart: number, rawEnd: number, kind: RawToken["kind"]): void => {
    if (text.length === 0) {
      return;
    }

    tokens.push({
      text,
      kind,
      rawStart,
      rawEnd,
      "renderStart": renderCursor,
      "renderEnd"  : renderCursor + text.length,
    });

    renderCursor = renderCursor + text.length;
  };

  const offsets = parsed.offsets;
  const separate = (anchor: number): void => push(" │ ", anchor, anchor, "separator");

  if (partsShown.time) {
    push(parsed.time, offsets.time[0], offsets.time[1], "time");
    separate(offsets.time[1]);
  }

  if (partsShown.level) {
    push(parsed.level, offsets.level[0], offsets.level[1], "level");
    separate(offsets.level[1]);
  }

  if (partsShown.target) {
    push(parsed.target, offsets.target[0], offsets.target[1], "target");
    separate(offsets.target[1]);
  }

  if (partsShown.message) {
    push(parsed.message, offsets.message[0], offsets.message[1], "message");
  }

  return tokens;
}

export function overlaySearch(
  tokens: Array<RawToken>,
  matches: Array<LogSearchMatchType>,
  currentGlobalIndex: number,
): Array<LogRenderSegmentType> {
  if (matches.length === 0) {
    return tokens.map((rawToken, index) => ({
      "text" : rawToken.text,
      "kind" : rawToken.kind,
      "state": "none",
      index,
    }));
  }

  const segments: Array<LogRenderSegmentType> = [];

  for (const token of tokens) {
    let renderCursor = token.renderStart;

    for (const match of matches) {
      if (match.charEnd <= token.rawStart || match.charStart >= token.rawEnd) {
        continue;
      }

      const overlapRawStart = Math.max(match.charStart, token.rawStart);
      const overlapRawEnd = Math.min(match.charEnd, token.rawEnd);

      const renderLength = token.text.length;

      const renderOverlapStart = token.renderStart + Math.min(
        overlapRawStart - token.rawStart,
        renderLength,
      );
      const renderOverlapEnd = token.renderStart + Math.min(
        overlapRawEnd - token.rawStart,
        renderLength,
      );

      if (renderOverlapStart > renderCursor) {
        segments.push({
          "text": token.text.slice(
            renderCursor - token.renderStart,
            renderOverlapStart - token.renderStart,
          ),
          "kind" : token.kind,
          "state": "none",
          "index": segments.length - 1,
        });
      }

      if (renderOverlapEnd > renderOverlapStart) {
        segments.push({
          "text": token.text.slice(
            renderOverlapStart - token.renderStart,
            renderOverlapEnd - token.renderStart,
          ),
          "kind" : token.kind,
          "state": match.globalIndex === currentGlobalIndex
            ? "current"
            : "found",
          "index": segments.length - 1,
        });
      }

      renderCursor = renderOverlapEnd;
    }

    if (renderCursor < token.renderEnd) {
      segments.push({
        "text" : token.text.slice(renderCursor - token.renderStart),
        "kind" : token.kind,
        "state": "none",
        "index": segments.length - 1,
      });
    }
  }

  return segments;
}
