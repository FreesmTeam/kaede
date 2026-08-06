<script setup lang="ts">
import { C } from "@/extendable/component-registry.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();
</script>

<template>
  <C.Home v-if="page === 'home'" />
  <C.Library v-else-if="page === 'library'" />
  <C.Settings v-else-if="page === 'settings'" />
  <C.AddInstance v-else-if="page === 'add-instance'" />
  <C.Profile v-else-if="page === 'profile'" />
  <!-- This block of elements is shown only when custom pages are selected -->
  <C.PageWrapper v-else>
    <div id="__custom-page__wrapper">
      <component :is="page" />
    </div>
  </C.PageWrapper>
</template>
