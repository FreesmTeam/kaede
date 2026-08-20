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
import ContextMenu from "@/components/general/layout/ContextMenu.vue";
import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import LaunchProgress from "@/components/general/layout/LaunchProgress.vue";
import Layout from "@/components/general/layout/Layout.vue";
import PagesSelector from "@/components/general/layout/PagesSelector.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import Router from "@/components/general/layout/Router.vue";
import Sidebar from "@/components/general/layout/Sidebar.vue";
import Tabs from "@/components/general/layout/Tabs.vue";
import Home from "@/components/home/Home.vue";
import Library from "@/components/library/Library.vue";
import Profile from "@/components/profile/Profile.vue";
import Settings from "@/components/settings/Settings.vue";
// */
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/log.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

type ComponentRegistryType = {
  [key: string]     : Component;
  "ContextMenu"     : Component;
  "GlobalBackground": Component;
  "LaunchProgress"  : Component;
  "Layout"          : Component;
  "PagesSelector"   : Component;
  "PageWrapper"     : Component;
  "Router"          : Component;
  "Sidebar"         : Component;
  "Tabs"            : Component;
  "AddInstance"     : Component;
  "Home"            : Component;
  "Library"         : Component;
  "Profile"         : Component;
  "Settings"        : Component;
};

// /*
export const LazyExtensionLoader = defineAsyncComponent(() => (
  import("@/components/general/extensions/ExtensionLoader.vue")
));
export const LazyPluginPlayground = defineAsyncComponent(() => (
  import("@/components/settings/tabs/PluginPlayground.vue")
));
// */

/*
 * Extensions can use this registry to replace existing components with their own ones.
 * When generating types using 'dts-bundle-generator', make sure to remove any Vue components
 */
const ComponentStorage = {
  // /*
  ContextMenu,
  GlobalBackground,
  LaunchProgress,
  Layout,
  PagesSelector,
  PageWrapper,
  Router,
  Sidebar,
  Tabs,
  AddInstance,
  Home,
  Library,
  Profile,
  Settings,
  // */
} as const;

/**
 * HMR might break this
 */
const PreservedForRestoring = { ...ComponentStorage };

// // @ts-expect-error The registry is missing required properties only for 'dts-bundle-generator'
export const C: ComponentRegistryType = shallowReactive(ComponentStorage);

export function __registerComponent(name: string, component: Component): void {
  if (name in C) {
    log.warn(__PRE_BUNDLED_FILENAME__, `Overriding application-side '${name}' component`);
    C[name] = component;

    return;
  }

  GlobalInternals.appInstance?.component?.(name, component);
}

export function __restoreComponent(name: string): boolean {
  if (IsKeyInObject(name, C) && IsKeyInObject(name, PreservedForRestoring)) {
    log.debug(__PRE_BUNDLED_FILENAME__, `Restoring a component '${name}'...`);
    C[name] = PreservedForRestoring[name];

    log.info(__PRE_BUNDLED_FILENAME__, `The component '${name}' was restored`);

    return true;
  }

  return false;
}
