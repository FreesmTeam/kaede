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

import { watch } from "vue";

import { parseEvent } from "@/lib/extension-api/parse-event.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";

export default class ExtensionAPI {
  private readonly id: string;

  private lifecycle: {
    "enable"      : (data: unknown) => Promise<unknown>;
    "disable"     : (data: unknown) => Promise<unknown>;
    "afterDisable": (data: unknown) => Promise<unknown>;
  } = {
    "enable"      : async () => {},
    "disable"     : async () => {},
    "afterDisable": async () => {},
  };

  private watchers: Map<() => unknown, WeakMap<(data: unknown) => unknown, () => void>> = new Map;

  constructor(id: string) {
    this.id = id;
  }

  public async enable(): Promise<void> {
    await this.lifecycle.enable(this.id);
  }

  public async disable(): Promise<void> {
    await this.lifecycle.disable(this.id);
  }

  public async afterDisable(): Promise<void> {
    await this.lifecycle.afterDisable(this.id);
  }

  public subscribe(event: unknown, callback: (data: unknown) => Promise<unknown>): ExtensionAPI {
    const result = parseEvent(event);

    switch (result.kind) {
      case "state": {
        let weakMap = this.watchers.get(result.watcher);

        if (!weakMap) {
          const newWeakMap = new WeakMap<(data: unknown) => unknown, () => void>;

          this.watchers.set(
            result.watcher,
            newWeakMap,
          );

          weakMap = newWeakMap;
        }

        weakMap.set(callback, watch(result.watcher, callback));

        break;
      }
      case "lifecycle": {
        if (result.id === "dirty-enable") {
          this.lifecycle.enable = callback;

          break;
        }

        if (result.timing === "before") {
          this.lifecycle.disable = callback;

          break;
        }

        this.lifecycle.afterDisable = callback;

        break;
      }
      case "hook": {
        if (result.position === "start") {
          result.hooks.unshift(callback as HookReturnType<unknown, unknown>[number]);

          break;
        }

        result.hooks.push(callback as HookReturnType<unknown, unknown>[number]);

        break;
      }
    }

    return this;
  }

  public unsubscribe(event: unknown, callback: (data: unknown) => Promise<unknown>): ExtensionAPI {
    const result = parseEvent(event);

    switch (result.kind) {
      case "state": {
        const unwatchMap = this.watchers.get(result.watcher);
        const unwatch = unwatchMap?.get?.(callback);

        unwatch?.();

        break;
      }
      case "lifecycle": {
        if (result.id === "dirty-enable") {
          this.lifecycle.enable = async (): Promise<void> => {};

          break;
        }

        if (result.timing === "before") {
          this.lifecycle.disable = async (): Promise<void> => {};

          break;
        }

        this.lifecycle.afterDisable = async (): Promise<void> => {};

        break;
      }
      case "hook": {
        const index = result.hooks.indexOf(
          callback as HookReturnType<unknown, unknown>[number],
        );

        if (index !== -1) {
          result.hooks.splice(index, 1);
        }

        break;
      }
    }

    return this;
  }
}
