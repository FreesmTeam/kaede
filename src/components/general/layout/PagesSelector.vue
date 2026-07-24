<script setup lang="ts">
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import {
  LazyAddInstance,
  LazyHome,
  LazyLibrary,
  LazyProfile,
  LazySettings,
} from "@/constants/ui/pages.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();
</script>

<template>
  <LazyHome v-if="page === 'home'" />
  <LazyLibrary v-else-if="page === 'library'" />
  <LazySettings v-else-if="page === 'settings'" />
  <LazyAddInstance v-else-if="page === 'add-instance'" />
  <LazyProfile v-else-if="page === 'profile'" />
  <!-- This block of elements is shown only when custom pages are selected -->
  <PageWrapper v-else>
    <div id="__custom-page__wrapper">
      <component :is="page" />
    </div>
  </PageWrapper>
</template>
