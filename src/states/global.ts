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

import { type Reactive, reactive } from "vue";

import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

/**
 * Contains all global application states.
 * Will be overwritten in 'main.ts' once the global states are ready
 */
export let globalStates: Reactive<GlobalStatesType>;

/**
 * Returns a reference to the proxied object of global states.
 */
export function getGlobalStates(): GlobalStatesType {
  return globalStates;
}

/**
 * Assign the actual global states to 'globalStates'.
 * This function is called in 'main.ts'
 */
export function declareGlobalStates(): void {
  globalStates = reactive<GlobalStatesType>(GlobalStateHelpers.getFromConfig());
}
