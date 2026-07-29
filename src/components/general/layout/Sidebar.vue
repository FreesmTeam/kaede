<script setup lang="ts">
import { inject, ref, shallowRef } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import SidebarProfile from "@/components/general/layout/SidebarProfile.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { TranslationsContextKey } from "@/constants/application.ts";
import { globalStates } from "@/states/global.ts";
import type {
  TranslationKey,
  TranslationsStateType,
} from "@/types/translations/translations.type.ts";

const Translations = inject<TranslationsStateType>(TranslationsContextKey);

const { styles } = useConfigColors();

const delayed = ref<NodeJS.Timeout | undefined>(undefined);
const tooltip = shallowRef<{
  "top" : number;
  "text": string | undefined;
  "show": boolean;
}>({
  "top" : 16,
  "text": globalStates?.sidebarItems?.[0] === "divider"
    ? "None"
    : globalStates?.sidebarItems?.[0]?.name,
  "show": false,
});

function removeTimeout(): void {
  clearTimeout(delayed.value);

  delayed.value = undefined;
}
function closeTooltip(): void {
  tooltip.value = {
    ...tooltip.value,
    "show": false,
  };

  removeTimeout();
}
function handleMouseOver(event: MouseEvent): void {
  if (delayed.value) {
    return;
  }

  const overlayTarget = event?.target as HTMLButtonElement;

  if (!overlayTarget || !overlayTarget?.id?.startsWith?.("__sidebar__entry")) {
    return;
  }

  const boundingRectangle = overlayTarget?.getBoundingClientRect?.();
  const offsetTop = boundingRectangle?.top;
  const textContent = overlayTarget?.ariaLabel;

  if (!offsetTop || !textContent) {
    closeTooltip();

    return;
  }

  const newTooltipInfo = {
    "top" : offsetTop,
    "text": Translations?.value?.Messages?.[`general.sidebar.${textContent}` as TranslationKey],
    "show": true,
  };

  if (!tooltip.value.show) {
    tooltip.value = {
      ...newTooltipInfo,
      "show": false,
    };

    delayed.value = setTimeout(() => {
      tooltip.value = newTooltipInfo;

      removeTimeout();
    }, 200);

    return;
  }

  tooltip.value = newTooltipInfo;
}
function handleButtonAction(event: PointerEvent, action: () => void): void {
  // '0' means a left click
  if (event.button !== 0) {
    return;
  }

  action();
  closeTooltip();
  // Close the log viewer in case of a page change
  globalStates.logs.show = false;
}
</script>

<template>
  <div
    id="__sidebar__hovering-tooltip"
    class="pointer-events-none absolute left-20 top-2 z-7000 w-fit rounded-md p-2 leading-none transition-[transform,opacity]"
    :style="{
      ...styles.widget,
      transform: `translateY(${tooltip.top}px)`,
      opacity  : tooltip.show ? 1 : 0,
    }"
  >
    {{ tooltip.text }}
  </div>
  <div
    @mouseleave="closeTooltip"
    id="__sidebar__wrapper"
    class="absolute bottom-0 left-0 top-0 z-5000 w-20 flex flex-col gap-2 p-2"
  >
    <SidebarProfile
      :handle-mouse-over="handleMouseOver"
      :handle-button-action="handleButtonAction"
    />
    <!-- Using 'py-2' instead of 'p-2' seems more logical, -->
    <!-- but somehow buttons are clipped on container overflow when I remove horizontal padding -->
    <TransitionGroup
      @mouseover="handleMouseOver"
      name="fade"
      tag="div"
      id="__sidebar__inner"
      class="thin-scrollbar scroll-gutter-stable-both h-fit w-full flex flex-col items-center gap-2 overflow-y-auto rounded-md p-2"
      :style="styles.widget"
    >
      <template
        v-for="(item, index) in globalStates?.sidebarItems"
        :key="item === 'divider' ? `divider-${index}` : item.name"
      >
        <button
          v-if="item !== 'divider'"
          :id="`__sidebar__entry-${item.name}-button`"
          :disabled="item.path === globalStates.currentPage"
          @pointerdown="(event: PointerEvent) => handleButtonAction(event, item.action)"
          class="__sidebar__entry-button relative grid size-12 shrink-0 place-items-center rounded-md transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
          :aria-label="item.name"
        >
          <span
            v-if="item.icon"
            :id="`__sidebar__entry-${item.name}-icon`"
            :class="[
              item.icon,
              'block size-6 shrink-0',
            ]"
          ></span>
          <Image
            v-else-if="item.image"
            :id="`__sidebar__entry-${item.name}-image`"
            :src="item.image"
            :alt="`An image for the ${item.name} sidebar item`"
            class-names="rounded-md size-8"
          />
          <MaterialRipple
            :id="`__sidebar__entry-${item.name}-overlay`"
            :label="item.name"
          />
        </button>
        <div
          v-else
          :id="`__sidebar__entry-divider-${index}`"
          class="__sidebar__entry-divider h-[1px] w-[calc(100%-8px)] bg-[theme(colors.neutral.100/.1)]"
        ></div>
      </template>
    </TransitionGroup>
  </div>
</template>
