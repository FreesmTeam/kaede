<script setup lang="ts">
import { computed } from "vue";

import ExtensionsSettings from "@/components/settings/tabs/ExtensionsSettings.vue";
import GeneralSettings from "@/components/settings/tabs/GeneralSettings.vue";
import { SettingsSections } from "@/constants/application.ts";
import { C, LazyPluginPlayground } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";

const stateKey = "settings" as const;

const selected = computed((): string => (
  globalStates?.pages?.[stateKey]?.tab ?? SettingsSections[0].id
));
</script>

<template>
  <C.PageWrapper>
    <div
      id="__settings-page__wrapper"
      class="h-fit w-full flex flex-col gap-2 py-2 pr-2 sm:h-full"
    >
      <C.Tabs
        :sections="SettingsSections"
        :state-key="stateKey"
      />
      <GeneralSettings v-if="selected === 'general'" />
      <ExtensionsSettings v-else-if="selected === 'extensions'" />
      <LazyPluginPlayground v-else-if="selected === 'plugin-playground'" />
    </div>
  </C.PageWrapper>
</template>
