<script setup lang="ts">
import { computed } from "vue";

import CleanInstance from "@/components/add-instance/tabs/CleanInstance.vue";
import ModrinthInstance from "@/components/add-instance/tabs/ModrinthInstance.vue";
import { InstanceCreationSections } from "@/constants/application.ts";
import { C } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";

const stateKey = "add-instance" as const;

const selected = computed((): string => (
  globalStates?.pages?.[stateKey]?.tab ?? InstanceCreationSections[0].id
));
</script>

<template>
  <C.PageWrapper>
    <div
      id="__add-instance-page__wrapper"
      class="w-full flex flex-col gap-2 py-2 pr-2"
    >
      <C.Tabs
        :sections="InstanceCreationSections"
        :state-key="stateKey"
      />
      <CleanInstance v-if="selected === 'clean-minecraft'" />
      <ModrinthInstance v-else-if="selected === 'modrinth'" />
      <div v-else id="__add-instance-page__page-placeholder">
        Nothing to see here for now :c
      </div>
    </div>
  </C.PageWrapper>
</template>
