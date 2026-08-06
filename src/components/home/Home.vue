<script setup lang="ts">
import { computed, inject } from "vue";

import AtAGlance from "@/components/home/glance/AtAGlance.vue";
import CurrentInstance from "@/components/home/instance/CurrentInstance.vue";
import CurrentPlaytime from "@/components/home/instance/CurrentPlaytime.vue";
import LastPlayed from "@/components/home/instance/LastPlayed.vue";
import Launch from "@/components/home/instance/Launch.vue";
import LaunchOptions from "@/components/home/instance/LaunchOptions.vue";
import { AuthStatesContextKey } from "@/constants/application.ts";
import { C } from "@/extendable/component-registry.ts";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const hasMSA = computed((): boolean => {
  if (!accounts?.value) {
    return false;
  }

  return accounts.value.some(({ msa }) => msa !== null);
});
</script>

<template>
  <C.PageWrapper>
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
        <!-- A simple '#__home-page__launch-section-wrapper { display: flex }' should work :3 -->
        <div
          id="__home-page__launch-section-wrapper"
          :class="[
            hasMSA ? 'flex' : 'hidden',
            'flex-nowrap gap-1 p-2',
          ]"
        >
          <Launch />
          <LaunchOptions />
        </div>
        <button
          id="__home-page__launch-section-no-msa"
          @click="() => Router.navigate('profile')"
          :class="[
            hasMSA ? 'hidden' : 'block',
            'p-4 text-sm text-start whitespace-pre hover:underline',
          ]"
        >
          {{ "A Microsoft account that\nowns the game is required.\nSign in to play" }}
        </button>
      </div>
    </div>
  </C.PageWrapper>
</template>
