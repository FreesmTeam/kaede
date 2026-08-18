<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useSkinRenderer } from "@/composables/use-skin-renderer.ts";
import { ActionKeys } from "@/constants/application.ts";
import { Routes } from "@/constants/routes.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const { handleMouseOver, handleButtonAction } = defineProps<{
  "handleMouseOver"   : (event: MouseEvent) => void;
  "handleButtonAction": (
    event: PointerEvent,
    item : GlobalStatesType["sidebarItems"][number],
  ) => Promise<void>;
}>();

const { styles } = useConfigColors();
const { canvas, shown } = useSkinRenderer({ "render": "2d-head" });

const actionItem = {
  "name"  : Routes.Profile,
  "path"  : Routes.Profile,
  "action": ActionKeys.SidebarRouteChange,
} satisfies GlobalStatesType["sidebarItems"][number];
</script>

<template>
  <div
    id="__sidebar__inner-profile"
    @mouseover="handleMouseOver"
    class="shrink-0 rounded-md p-2"
    :style="styles.widget"
  >
    <button
      id="__sidebar__entry-profile-button"
      :disabled="Routes.Profile === globalStates.currentPage"
      @pointerdown="(event: PointerEvent) => handleButtonAction(event, actionItem)"
      class="__sidebar__entry-button relative grid size-12 shrink-0 place-items-center rounded-md text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
      aria-label="profile"
    >
      <canvas
        ref="canvas"
        id="__sidebar__entry-profile-canvas"
        :class="[
          shown ? 'opacity-100' : 'opacity-0',
          'rounded-md duration-300 transition-[opacity]',
        ]"
      />
      <MaterialRipple
        id="__sidebar__entry-profile-overlay"
        :label="`profile`"
      />
    </button>
  </div>
</template>
