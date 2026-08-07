<script setup lang="ts">
import { computed } from "vue";

import DevelopmentSettings from "@/components/settings/tabs/DevelopmentSettings.vue";
import ExtensionsSettings from "@/components/settings/tabs/ExtensionsSettings.vue";
import JavaSettings from "@/components/settings/tabs/JavaSettings.vue";
import MinecraftSettings from "@/components/settings/tabs/MinecraftSettings.vue";
import UserInterfaceSettings from "@/components/settings/tabs/UserInterfaceSettings.vue";
import { SettingsSections } from "@/constants/application.ts";
import { C, LazyPluginPlayground } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";
import type { TabSectionType } from "@/types/ui/tab-section.type.ts";

const stateKey = "settings" as const;

const selected = computed((): string => (
  globalStates?.pages?.[stateKey]?.tab ?? SettingsSections[0].id
));
const sections = computed((): Array<TabSectionType> => {
  if (globalStates.extensions.enabled) {
    return SettingsSections;
  }

  return SettingsSections.filter(({ id }) => id !== "plugin-playground");
});
</script>

<template>
  <C.PageWrapper>
    <div
      id="__settings-page__wrapper"
      class="h-fit w-full flex flex-col gap-2 py-2 pr-2 sm:h-full"
    >
      <C.Tabs
        :sections="sections"
        :state-key="stateKey"
      />
      <UserInterfaceSettings v-if="selected === 'user-interface'" />
      <MinecraftSettings v-else-if="selected === 'minecraft'" />
      <JavaSettings v-else-if="selected === 'java'" />
      <ExtensionsSettings v-else-if="selected === 'extensions'" />
      <DevelopmentSettings v-else-if="selected === 'development'" />
      <LazyPluginPlayground v-else-if="selected === 'plugin-playground'" />
    </div>
  </C.PageWrapper>
</template>
