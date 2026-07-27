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

import { Channel, invoke } from "@tauri-apps/api/core";
import { onMounted, onUnmounted, type ShallowRef, shallowRef } from "vue";

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

type LogStreamEventType =
  | { "type": "snapshot"; "data": Array<string> }
  | { "type": "lines";    "data": Array<string> }
  | { "type": "truncated" };

export function useLogStream(): {
  "lines": ShallowRef<{ "list": Array<string> }>;
} {
  const lines = shallowRef<{ "list": Array<string> }>({ "list": [] });

  onMounted(() => {
    const channel = new Channel<LogStreamEventType>;

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    channel.onmessage = (event): void => {
      switch (event.type) {
        case "snapshot": {
          lines.value = { "list": event.data };

          break;
        }
        case "lines": {
          for (const line of event.data) {
            lines.value.list.push(line);
          }

          lines.value = { "list": lines.value.list };

          break;
        }
        case "truncated": {
          lines.value = { "list": [] };

          break;
        }
      }
    };

    invoke("stream_logs", { "onEvent": channel }).catch((error: unknown) => {
      log.error(__PRE_BUNDLED_FILENAME__, "The log stream failed:", Errors.prettify(error));
    });
  });

  onUnmounted(() => {
    void invoke("stop_log_stream");
  });

  return { lines };
}
