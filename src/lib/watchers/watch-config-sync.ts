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

import { useDebounceFn } from "@vueuse/core";
import { watch } from "vue";

import Configs from "@/lib/configs";
import { globalStates } from "@/states/global.ts";

/**
 * Updates config file on any config-related global states changes.
 */
export function watchConfigSync(): () => void {
  const debouncedWrite = useDebounceFn(Configs.sync, 300);

  return watch(
    // Only watch config-related fields
    () => [
      globalStates.development,
      globalStates.extensions,
      globalStates.ui,
      globalStates.selected,
      globalStates.locale,
      globalStates.logs,
      globalStates.minecraft,
    ],
    debouncedWrite,
    { "deep": true },
  );
}
