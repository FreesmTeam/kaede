<script setup lang="ts">
import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import PagesSelector from "@/components/general/layout/PagesSelector.vue";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full">
    <GlobalBackground />
    <Transition name="page">
      <PagesSelector :page="page" />
    </Transition>
  </div>
</template>
