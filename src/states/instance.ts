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

import { type ShallowReactive, shallowReactive } from "vue";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

/**
 * Contains all Minecraft instance states.
 */
export let instanceStates: ShallowReactive<InstanceStatesType>;

/**
 * Assign the actual instance states to 'instanceStates'.
 * This function is called in 'main.ts'
 */
export function declareInstanceStates(): void {
  /*
   * We can avoid using 'structuredClone' here since 'GlobalInternals.initialInstances'
   * is shallowReactive, meaning a simple one-level deep spreading will detach reactive
   * fields, so any new changes should not touch 'GlobalInternals.initialInstances'
   */
  instanceStates = shallowReactive<InstanceStatesType>({ ...GlobalInternals.initialInstances });
  GlobalObject.states.instanceStates = instanceStates;
}
