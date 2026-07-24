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

import { type Component, shallowReactive } from "vue";

import ContextMenu from "@/components/general/layout/ContextMenu.vue";
import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import LaunchProgress from "@/components/general/layout/LaunchProgress.vue";
import PagesSelector from "@/components/general/layout/PagesSelector.vue";
import Sidebar from "@/components/general/layout/Sidebar.vue";

interface ComponentRegistryType {
  [key: string]     : Component;
  "Sidebar"         : Component;
  "ContextMenu"     : Component;
  "LaunchProgress"  : Component;
  "GlobalBackground": Component;
  "PagesSelector"   : Component;
}

export const C: ComponentRegistryType = shallowReactive({
  "Sidebar"         : Sidebar,
  "ContextMenu"     : ContextMenu,
  "LaunchProgress"  : LaunchProgress,
  "GlobalBackground": GlobalBackground,
  "PagesSelector"   : PagesSelector,
});

export function __registerComponent(name: string, component: Component): void {
  C[name] = component;
}
