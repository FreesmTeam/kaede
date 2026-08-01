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
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import Row from "@/components/general/base/Row.vue";
import RowContainer from "@/components/general/base/RowContainer.vue";
import Toggle from "@/components/general/base/Toggle.vue";
import { globalStates } from "@/states/global.ts";

const toggle = {
  "enabled": (): boolean => (
    globalStates.extensions.enabled = !globalStates.extensions.enabled
  ),
  "allowUnrestrictedUntrusted": (): boolean => (
    globalStates.extensions.allowUnrestrictedUntrusted =
      !globalStates.extensions.allowUnrestrictedUntrusted
  ),
  "showAppAfterExtensionsLoad": (): boolean => (
    globalStates.extensions.showAppAfterExtensionsLoad =
      !globalStates.extensions.showAppAfterExtensionsLoad
  ),
  "extension": (index: number): void => {
    // TODO: first show a custom modal with a 3-sec delay
    globalStates.extensions.list[index].enabled =
      !globalStates.extensions.list[index].enabled;
  },
};
// TODO: show trusted unrestricted first, then sandboxed, then untrusted unrestricted
</script>

<template>
  <div
    id="__settings-page__extensions-wrapper"
    class="h-fit w-full flex flex-col gap-2 pb-2"
  >
    <RowContainer id="__settings-page__extensions-inner">
      <Row
        class="relative cursor-pointer"
        icon="i-lucide-blocks"
        id-root="__settings-page__extensions-enabled"
        title="Enable extensions"
        subtitle="Load trusted or community-made extensions"
        @click="toggle.enabled"
      >
        <Toggle
          id="__settings-page__extensions-enabled-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.enabled"
        />
        <MaterialRipple />
      </Row>
      <Row
        class="relative cursor-pointer"
        icon="i-lucide-door-open"
        id-root="__settings-page__extensions-allow-untrusted"
        title="Allow unrestricted untrusted extensions"
        subtitle="Allow untrusted extensions to run outside of the sandbox"
        @click="toggle.allowUnrestrictedUntrusted"
      >
        <Toggle
          id="__settings-page__extensions-allow-untrusted-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.allowUnrestrictedUntrusted"
        />
        <MaterialRipple />
      </Row>
      <Row
        class="relative cursor-pointer"
        icon="i-lucide-clock"
        id-root="__settings-page__extensions-show-after-initialization"
        title="Show window after extensions load"
        subtitle="Wait for extensions to initialize before showing the launcher window"
        @click="toggle.showAppAfterExtensionsLoad"
      >
        <Toggle
          id="__settings-page__extensions-show-after-initialization-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.showAppAfterExtensionsLoad"
        />
        <MaterialRipple />
      </Row>
      <Row
        icon="i-lucide-shield-check"
        id-root="__settings-page__extensions-list"
        title="Trusted extensions"
        subtitle="Enable or disable safe extensions"
      />
      <Row
        v-for="(entry, index) in globalStates.extensions.list"
        :key="entry.id"
        :id-root="`__settings-page__extensions-list-${entry.id}`"
        class="relative cursor-pointer"
        :title="`${entry.id}`"
        subtitle="Wait for extensions to initialize before showing the launcher window"
        @click="() => toggle.extension(index)"
      >
        <Toggle
          id="__settings-page__extensions-show-after-initialization-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.list[index].enabled"
        />
        <MaterialRipple />
      </Row>
      <Row
        icon="i-lucide-box"
        id-root="__settings-page__extensions-list"
        title="Community extensions (sandboxed)"
        subtitle="Enable or disable community extensions running in a sandbox"
      />
      <Row
        v-for="(entry, index) in globalStates.extensions.list"
        :key="entry.id"
        :id-root="`__settings-page__extensions-list-${entry.id}`"
        class="relative cursor-pointer"
        :title="`${entry.id}`"
        subtitle="Wait for extensions to initialize before showing the launcher window"
        @click="() => toggle.extension(index)"
      >
        <Toggle
          id="__settings-page__extensions-show-after-initialization-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.list[index].enabled"
        />
        <MaterialRipple />
      </Row>
      <Row
        icon="i-lucide-triangle-alert"
        id-root="__settings-page__extensions-list"
        title="Community extensions (unrestricted)"
        subtitle="Enable or disable unsafe extensions"
      />
      <Row
        v-for="(entry, index) in globalStates.extensions.list"
        :key="entry.id"
        :id-root="`__settings-page__extensions-list-${entry.id}`"
        class="relative cursor-pointer"
        :title="`${entry.id}`"
        subtitle="Wait for extensions to initialize before showing the launcher window"
        @click="() => toggle.extension(index)"
      >
        <Toggle
          id="__settings-page__extensions-show-after-initialization-toggle"
          class="pointer-events-none"
          :model-value="globalStates.extensions.list[index].enabled"
        />
        <MaterialRipple />
      </Row>
    </RowContainer>
  </div>
</template>
