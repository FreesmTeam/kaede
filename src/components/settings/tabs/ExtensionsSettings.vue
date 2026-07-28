<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { computed, nextTick } from "vue";

import SettingsRow from "@/components/settings/base/SettingsRow.vue";
import SettingsToggle from "@/components/settings/base/SettingsToggle.vue";
import Configs from "@/lib/configs";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const idRoot = "__settings-page__extensions";

const enabled = computed((): boolean => (
  globalStates?.extensions?.enabled === true
));
const showAfterInitialization = computed((): boolean => (
  globalStates?.misc?.showAfterExtensionsInitialization === true
));
const autoConfigSync = computed((): boolean => (
  globalStates?.misc?.autoConfigSync === true
));

async function overrideExtensions(
  input: Partial<GlobalStatesType["extensions"]>,
): Promise<void> {
  GlobalStateHelpers.change("extensions", {
    ...GlobalStateHelpers.get().extensions,
    ...input,
  });

  // Global states have changed, persist them to the config file
  await nextTick();
  await Configs.sync();
}
async function overrideMisc(
  input: Partial<GlobalStatesType["misc"]>,
): Promise<void> {
  GlobalStateHelpers.change("misc", {
    ...GlobalStateHelpers.get().misc,
    ...input,
  });

  // Global states have changed, persist them to the config file
  await nextTick();
  await Configs.sync();
}
async function handleEnabledToggle(isEnabled: boolean): Promise<void> {
  await overrideExtensions({ "enabled": isEnabled });
}
async function handleShowAfterInitializationToggle(isEnabled: boolean): Promise<void> {
  await overrideMisc({ "showAfterExtensionsInitialization": isEnabled });
}
async function handleAutoConfigSyncToggle(isEnabled: boolean): Promise<void> {
  await overrideMisc({ "autoConfigSync": isEnabled });
}
</script>

<template>
  <div
    :id="`${idRoot}-wrapper`"
    class="h-fit w-full flex flex-col gap-2"
  >
    <SettingsRow
      :id-root="`${idRoot}-enabled`"
      title="Enable extensions"
      subtitle="Load installed extensions when the launcher starts"
    >
      <SettingsToggle
        :id="`${idRoot}-enabled-toggle`"
        :model-value="enabled"
        :on-toggle="handleEnabledToggle"
      />
    </SettingsRow>
    <SettingsRow
      :id-root="`${idRoot}-show-after-initialization`"
      title="Show window after extensions load"
      subtitle="Wait for extensions to initialize before revealing the launcher window"
    >
      <SettingsToggle
        :id="`${idRoot}-show-after-initialization-toggle`"
        :model-value="showAfterInitialization"
        :on-toggle="handleShowAfterInitializationToggle"
      />
    </SettingsRow>
    <SettingsRow
      :id-root="`${idRoot}-auto-config-sync`"
      title="Automatic config sync"
      subtitle="Keep the configuration file in sync with the launcher state automatically"
    >
      <SettingsToggle
        :id="`${idRoot}-auto-config-sync-toggle`"
        :model-value="autoConfigSync"
        :on-toggle="handleAutoConfigSyncToggle"
      />
    </SettingsRow>
  </div>
</template>
