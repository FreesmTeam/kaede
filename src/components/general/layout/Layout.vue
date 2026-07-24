<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";

import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import PageError from "@/components/general/errors/PageError.vue";
import ContextProviders from "@/components/general/misc/ContextProviders.vue";
import { C } from "@/extendable/component-registry.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const { toShowSidebar, toShowContextMenu, toShowNativeContextMenu, page } = defineProps<{
  "toShowSidebar"          : boolean;
  "toShowContextMenu"      : boolean;
  "toShowNativeContextMenu": boolean;
  "page"                   : RouteType;
}>();

const contextMenu = ref<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>({ "opened": false, "x": 0, "y": 0 });

function closeContextMenu(): void {
  contextMenu.value.opened = false;
}
function showContextMenu(event: MouseEvent): void {
  if (!toShowNativeContextMenu) {
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

GlobalObject.libs.ContextMenu.show = showContextMenu;
GlobalObject.libs.ContextMenu.close = closeContextMenu;

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
        v-if="toShowContextMenu"
        :opened="contextMenu.opened"
        :x="contextMenu.x"
        :y="contextMenu.y"
      />
      <C.Sidebar v-if="toShowSidebar" />
      <!-- Pages error boundary -->
      <ErrorBoundary :reset-key="page">
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
