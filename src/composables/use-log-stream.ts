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

import { onMounted, onUnmounted, type ShallowRef, shallowRef } from "vue";

import { Host, type LogStreamEvent } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

export function useLogStream(): {
  "lines": ShallowRef<{ "list": Array<string> }>;
} {
  const lines = shallowRef<{ "list": Array<string> }>({ "list": [] });

  onMounted(() => {
    const handleEvent = (event: LogStreamEvent): void => {
      switch (event.type) {
        case "snapshot": {
          lines.value = { "list": [...event.data] };

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

    void Host.logs.stream(handleEvent).catch((error: unknown) => {
      log.error(__PRE_BUNDLED_FILENAME__, "The log stream failed:", Errors.prettify(error));
    });
  });

  onUnmounted(() => {
    void Host.logs.stopStream().catch((error: unknown) => {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Stopping the log stream failed:",
        Errors.prettify(error),
      );
    });
  });

  return { lines };
}
