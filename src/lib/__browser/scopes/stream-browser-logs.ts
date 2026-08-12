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

/**
 * ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
 */

import type { Channel } from "@tauri-apps/api/core";

import { GlobalInternals } from "@/extendable/global-internals.ts";

/*
 * A replica of the 'logging.rs' log tail. The desktop side tails the
 * 'latest.log' file; the browser tails the in-memory log line buffer
 */

type LogStreamEventType =
  | { "type": "snapshot"; "data": Array<string> }
  | { "type": "lines";    "data": Array<string> }
  | { "type": "truncated" };

const Tick: number = 100;

let currentInterval: ReturnType<typeof setInterval> | undefined;

// Starting a new stream stops the previous one, just like on the desktop side
export function streamBrowserLogs(channel: Channel<LogStreamEventType>): void {
  stopBrowserLogStream();

  const logs: Array<string> = GlobalInternals.logsInBrowser;

  let offset: number = logs.length;

  channel.onmessage({
    "type": "snapshot",
    "data": logs.slice(0, offset),
  });

  currentInterval = setInterval((): void => {
    if (logs.length < offset) {
      offset = 0;

      return channel.onmessage({ "type": "truncated" });
    }

    if (logs.length === offset) {
      return;
    }

    channel.onmessage({
      "type": "lines",
      "data": logs.slice(offset),
    });
    offset = logs.length;
  }, Tick);
}

export function stopBrowserLogStream(): boolean {
  if (currentInterval === undefined) {
    return false;
  }

  clearInterval(currentInterval);
  currentInterval = undefined;

  return true;
}
