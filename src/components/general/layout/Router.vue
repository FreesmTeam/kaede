<script setup lang="ts">
import { computed } from "vue";

import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import { C } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const page = computed((): RouteType => {
  return globalStates.currentPage;
});
</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full">
    <GlobalBackground />
    <Transition name="page">
      <C.PagesSelector :page="page" />
    </Transition>
  </div>
</template>
