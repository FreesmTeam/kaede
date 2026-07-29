<script setup lang="ts">
import { computed } from "vue";

import CleanInstance from "@/components/add-instance/tabs/CleanInstance.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import Tabs from "@/components/general/layout/Tabs.vue";
import { InstanceCreationSections } from "@/constants/application.ts";
import { globalStates } from "@/states/global.ts";

const stateKey = "add-instance" as const;

const selected = computed((): string => (
  globalStates?.pages?.[stateKey]?.tab ?? InstanceCreationSections[0].id
));
</script>

<template>
  <PageWrapper>
    <div
      id="__add-instance-page__wrapper"
      class="w-full flex flex-col gap-2 py-2 pr-2"
    >
      <Tabs
        :sections="InstanceCreationSections"
        :state-key="stateKey"
      />
      <CleanInstance v-if="selected === 'clean-minecraft'" />
      <div v-else id="__add-instance-page__page-placeholder"></div>
    </div>
  </PageWrapper>
</template>
