<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { globalStates } from "@/states/global.ts";

const { opened, x, y } = defineProps<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>();

const offset: number = 2;

/*
 * We cannot measure the context menu size in the 'computed' state
 * since the element itself is still hidden in the DOM because of the <Transition />.
 *
 * That is why we use cache for the context menu size
 */
const cachedSize = ref<{
  "height": number;
  "width" : number;
}>({
  "height": 0,
  "width" : 0,
});

const contextMenu = useTemplateRef<HTMLDivElement>("contextMenu");

const hasNativeContextMenu = computed((): boolean => (
  globalStates?.development?.enableNativeContextMenu ?? false
));
const styles = computed((): {
  "left"  ?: string;
  "top"   ?: string;
  "right" ?: string;
  "bottom"?: string;
} => {
  const position: {
    "left"  ?: string;
    "top"   ?: string;
    "right" ?: string;
    "bottom"?: string;
  } = {};
  const boundaries = {
    "height": window.innerHeight,
    "width" : window.innerWidth,
  };

  /*
   * The browser context menu seems to always go to the right and bottom sides
   * so we place the custom one to left and top
   */
  const shouldShowNativeMenu: boolean = hasNativeContextMenu.value;
  // By default, the context menu goes to the right and bottom sides
  const isHorizontallyOutOfBounds: boolean = cachedSize.value.width + x + offset > boundaries.width;
  const isVerticallyOutOfBounds: boolean = cachedSize.value.height + y + offset > boundaries.height;

  if (shouldShowNativeMenu || isHorizontallyOutOfBounds) {
    position.right = `${boundaries.width - x + offset}px`;
  } else {
    position.left = `${x + offset}px`;
  }

  if (shouldShowNativeMenu || isVerticallyOutOfBounds) {
    position.bottom = `${boundaries.height - y + offset}px`;
  } else {
    position.top = `${y + offset}px`;
  }

  return position;
});

watch(
  (): number => x + y,
  async (): Promise<void> => {
    const target: HTMLDivElement | null = contextMenu.value;

    if (!target) {
      return;
    }

    /*
     * The context menu becomes visible (the 'display' property),
     * therefore getting the actual element size, only on the next Vue tick
     */
    await nextTick();

    cachedSize.value.height = target.clientHeight;
    cachedSize.value.width = target.clientWidth;
  },
);
</script>

<template>
  <Transition name="pop" mode="out-in">
    <div
      v-show="opened"
      ref="contextMenu"
      id="__context_menu__wrapper"
      class="__context_menu__wrapper __context-menu-disable absolute z-9000 flex flex-col gap-1 overflow-hidden rounded-md bg-neutral-800 py-1 text-white drop-shadow-lg"
      :style="styles"
    >
      <button
        v-for="item in globalStates?.contextMenuItems"
        :key="item.name"
        :id="`__context-menu__entry-${item.icon}`"
        @click="item.action"
        class="__context_menu__entry __context-menu-disable relative flex flex-nowrap items-center gap-2 p-2 hover:bg-neutral-700"
      >
        <span
          v-if="item.icon"
          :id="`__context-menu__entry-${item.icon}-icon`"
          :class="[item.icon, '__context-menu-disable block size-4']"
        ></span>
        <Image
          v-else-if="item.image"
          :id="`__context-menu__entry-${item.name}-image`"
          :src="item.image"
          :alt="`An image for the ${item.name} context menu item`"
          class-names="size-4"
        />
        <span
          :id="`__context-menu__entry-${item.icon}-label`"
          class="__context-menu-disable block whitespace-nowrap text-sm leading-none"
        >
          {{ item.name }}
        </span>
        <MaterialRipple />
      </button>
    </div>
  </Transition>
</template>
