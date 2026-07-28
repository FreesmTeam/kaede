<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";

import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import PageError from "@/components/general/errors/PageError.vue";
import ContextProviders from "@/components/general/misc/ContextProviders.vue";
import { ContextMenu } from "@/constants/application.ts";
import { getComponents } from "@/extendable/component-registry.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { globalStates } from "@/states/global.ts";

const contextMenu = ref<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>({ "opened": false, "x": 0, "y": 0 });

function closeContextMenu(): void {
  contextMenu.value.opened = false;
}
function showContextMenu(event: MouseEvent): void {
  if (!globalStates.development.enableNativeContextMenu) {
    event.preventDefault();
  }

  const target = event.target as HTMLElement;

  if (
    target?.className?.includes?.("__context_menu__wrapper") ||
    target?.parentElement?.className?.includes?.("__context_menu__entry")
  ) {
    return;
  }

  if (
    target?.className?.includes?.("__context-menu-disable") ||
    target?.className?.includes?.("_rippleOverlay")
  ) {
    closeContextMenu();

    return;
  }

  contextMenu.value.opened = true;
  contextMenu.value.x = event.clientX;
  contextMenu.value.y = event.clientY;
}

ContextMenu.show = showContextMenu;
ContextMenu.close = closeContextMenu;

GlobalObject.libs.ContextMenu = ContextMenu;

useEventListener(window, "pointerdown", (event: PointerEvent) => {
  const target = event.target as HTMLElement;

  if (
    target?.className?.includes?.("__context_menu__wrapper") ||
    target?.parentElement?.className?.includes?.("__context_menu__entry")
  ) {
    return;
  }

  closeContextMenu();
});

const C = getComponents();
</script>

<template>
  <ContextProviders>
    <div
      id="__layout__wrapper"
      @contextmenu="showContextMenu"
      class="relative h-vh w-full flex flex-nowrap gap-0 overflow-hidden text-white"
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
          <slot />
        </template>

        <!-- In case of an error, show this template -->
        <template #error="{ currentError }">
          <PageError :error="currentError" />
        </template>
      </ErrorBoundary>
    </div>
  </ContextProviders>
</template>
