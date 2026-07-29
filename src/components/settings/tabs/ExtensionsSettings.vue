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
import { computed } from "vue";

import SettingsRow from "@/components/settings/base/SettingsRow.vue";
import SettingsToggle from "@/components/settings/base/SettingsToggle.vue";
import { globalStates } from "@/states/global.ts";

const idRoot = "__settings-page__extensions";

const enabled = computed((): boolean => (
  globalStates.extensions.enabled
));
const allowUntrusted = computed((): boolean => (
  globalStates.extensions.allowUnrestrictedUntrusted
));
const showAfterInitialization = computed((): boolean => (
  globalStates.extensions.showAppAfterExtensionsLoad
));

function handleEnabledToggle(value: boolean): void {
  globalStates.extensions.enabled = value;
}
function handleAllowUntrustedToggle(value: boolean): void {
  globalStates.extensions.allowUnrestrictedUntrusted = value;
}
function handleShowAfterInitializationToggle(value: boolean): void {
  globalStates.extensions.showAppAfterExtensionsLoad = value;
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
      :id-root="`${idRoot}-allow-untrusted`"
      title="Allow unrestricted untrusted extensions"
      subtitle="Run untrusted extensions outside of the sandbox. Only enable this if you trust them"
    >
      <SettingsToggle
        :id="`${idRoot}-allow-untrusted-toggle`"
        :model-value="allowUntrusted"
        :on-toggle="handleAllowUntrustedToggle"
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
  </div>
</template>
