<script setup lang="ts">
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import AtAGlance from "@/components/home/glance/AtAGlance.vue";
import CurrentInstance from "@/components/home/instance/CurrentInstance.vue";
import CurrentPlaytime from "@/components/home/instance/CurrentPlaytime.vue";
import LastPlayed from "@/components/home/instance/LastPlayed.vue";
import Launch from "@/components/home/instance/Launch.vue";
import LaunchOptions from "@/components/home/instance/LaunchOptions.vue";
import { globalStates } from "@/states/global.ts";
</script>

<template>
  <PageWrapper>
    <div id="__home-page__wrapper" class="h-full flex flex-col justify-between gap-2">
      <AtAGlance v-if="globalStates.ui.atAGlance.length > 0" />
      <div
        id="__home-page__content"
        class="flex flex-nowrap items-end justify-between gap-2 pb-2 pr-2"
      >
        <div
          id="__home-page__instance-section-wrapper"
          class="relative w-88 flex flex-col items-stretch gap-0"
        >
          <CurrentInstance />
          <CurrentPlaytime v-if="globalStates?.selected?.stats === 'playtime'" />
          <LastPlayed v-else-if="globalStates?.selected?.stats === 'last-launch'" />
        </div>
        <div id="__home-page__launch-section-wrapper" class="flex flex-nowrap gap-1 p-2">
          <Launch />
          <LaunchOptions />
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
