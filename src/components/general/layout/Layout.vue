<script setup lang="ts">
import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import PageError from "@/components/general/errors/PageError.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { ContextMenu } from "@/constants/application.ts";
import { C } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";

const { contextMenu } = defineProps<{
  "contextMenu": {
    "opened": boolean;
    "x"     : number;
    "y"     : number;
  };
}>();

const { styles } = useConfigColors();
</script>

<template>
  <div
    id="__layout__wrapper"
    @contextmenu="ContextMenu.show"
    class="relative h-vh w-full flex flex-nowrap gap-0 overflow-hidden text-white"
    :style="styles.root"
  >
    <C.LaunchProgress />
    <C.ContextMenu
      :opened="contextMenu.opened"
      :x="contextMenu.x"
      :y="contextMenu.y"
    />
    <C.Sidebar />
    <!-- Pages error boundary -->
    <ErrorBoundary :reset-key="globalStates.currentPage">
      <template #default>
        <!-- The 'Router' component is accessible for extensions and customizable
          -- but is optional for custom layouts
          -->
        <C.Router />
        <!-- 'slot' accepts the 'must have' components, but extensions can still reject them -->
        <slot />
      </template>

      <!-- In case of an error, show this template -->
      <template #error="{ currentError }">
        <PageError :error="currentError" />
      </template>
    </ErrorBoundary>
  </div>
</template>
