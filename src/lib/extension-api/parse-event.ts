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

import type { KaedeNamespaceType } from "@/declarations.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export function parseEvent(event: unknown): {
  "kind": "lifecycle";
  "id"  : "dirty-enable" | "disable";
} | {
  "kind"    : "hook";
  "id"      : keyof KaedeNamespaceType["hooks"];
  "timing"  : "before" | "after";
  "position": "start" | "end";
  "hooks"   : HookReturnType<unknown, unknown>;
} | {
  "kind"   : "state";
  "watcher": () => unknown;
} {
  if (typeof event === "function") {
    return {
      "kind"   : "state",
      "watcher": event as () => unknown,
    };
  }

  if (typeof event !== "string") {
    throw new TypeError("Events must be either a function or a string");
  }

  const [base, id, timing, position]: Array<string> = event.split("::");

  switch (base) {
    case "lifecycle": {
      if (id !== "dirty-enable" && id !== "disable") {
        throw new TypeError("Invalid lifecycle event name");
      }

      return {
        "kind": "lifecycle",
        "id"  : id,
      };
    }
    case "hook": {
      if (!id || !timing) {
        throw new TypeError("Invalid hook event name");
      }

      if (!(IsKeyInObject(id, GlobalObject.hooks))) {
        throw new TypeError("This hook ID does not exist");
      }

      const hook: object = GlobalObject.hooks[id];

      if (!(IsKeyInObject(timing, hook))) {
        throw new TypeError("Such timing does not exist");
      }

      return {
        "kind"    : "hook",
        "id"      : id,
        "timing"  : timing,
        "position": position === "start" ? "start" : "end",
        "hooks"   : GlobalObject.hooks[id][timing],
      };
    }
    default: {
      throw new Error("Invalid event name");
    }
  }
}
