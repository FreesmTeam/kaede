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

import { type Component, defineAsyncComponent, shallowReactive } from "vue";

// /*
import AddInstance from "@/components/add-instance/AddInstance.vue";
import CleanInstance from "@/components/add-instance/tabs/CleanInstance.vue";
import ContextMenu from "@/components/general/layout/ContextMenu.vue";
import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import LaunchProgress from "@/components/general/layout/LaunchProgress.vue";
import Sidebar from "@/components/general/layout/Sidebar.vue";
// */

interface ComponentRegistryType {
  [key: string]         : Component;
  "Sidebar"             : Component;
  "ContextMenu"         : Component;
  "LaunchProgress"      : Component;
  "GlobalBackground"    : Component;
  "LazyPluginPlayground": Component;
}

/*
 * Extensions can use this registry to replace existing components with their own ones.
 * When generating types using 'dts-bundle-generator', make sure to remove any Vue components
 */
// // @ts-expect-error The registry is missing required properties only for 'dts-bundle-generator'
export const C: ComponentRegistryType = shallowReactive({
  // /*

  // 'add-instance/'
  AddInstance,
  CleanInstance,

  // 'general/'
  Sidebar,
  ContextMenu,
  LaunchProgress,
  GlobalBackground,

  // 'settings/'
  "LazyPluginPlayground": defineAsyncComponent(() => (
    import("@/components/settings/tabs/PluginPlayground.vue")
  )),
  // */
});

export function getComponents(): ComponentRegistryType {
  return C;
}

export function __registerComponent(name: string, component: Component): void {
  C[name] = component;
}
