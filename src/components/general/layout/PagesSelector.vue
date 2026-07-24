<script setup lang="ts">
import AddInstance from "@/components/add-instance/AddInstance.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import Home from "@/components/home/Home.vue";
import Library from "@/components/library/Library.vue";
import Profile from "@/components/profile/Profile.vue";
import Settings from "@/components/settings/Settings.vue";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();
</script>

<template>
  <Home v-if="page === 'home'" />
  <Library v-else-if="page === 'library'" />
  <Settings v-else-if="page === 'settings'" />
  <AddInstance v-else-if="page === 'add-instance'" />
  <Profile v-else-if="page === 'profile'" />
  <!-- This block of elements is shown only when custom pages are selected -->
  <PageWrapper v-else>
    <div id="__custom-page__wrapper">
      <component :is="page" />
    </div>
  </PageWrapper>
</template>
