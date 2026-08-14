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

import { shallowReactive } from "vue";

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";

export type ActionType<T> = (properties: T) => void | Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericAction = ActionType<any>;

export const Actions = shallowReactive<Record<string, GenericAction>>({});

export const ActionRegistry = {
  "register": <T>(id: string, action: ActionType<T>) => {
    Actions[id] = action;
  },
  "execute": async <T>(id: string, properties: T): Promise<boolean> => {
    const callback = Actions[id];

    if (!callback) {
      return false;
    }

    try {
      await callback(properties);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `An error occurred while executing an action '${id}':`,
        Errors.prettify(error),
      );

      return false;
    }

    return true;
  },
  "get": <T>(id: string): ActionType<T> | undefined => {
    return Actions[id];
  },
  "getAll": (): Array<{ "id": string; "action": GenericAction }> => Object
    .entries(Actions)
    .map(([id, action]) => ({ id, action })),
} as const;
