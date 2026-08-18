<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import ContextMenuChildren from "@/components/general/layout/ContextMenuChildren.vue";
import type { ActionKeyType } from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

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
  const toShowNativeMenu: boolean = hasNativeContextMenu.value;
  // By default, the context menu goes to the right and bottom sides
  const isHorizontallyOutOfBounds: boolean = cachedSize.value.width + x + offset > boundaries.width;
  const isVerticallyOutOfBounds: boolean = cachedSize.value.height + y + offset > boundaries.height;

  if (toShowNativeMenu || isHorizontallyOutOfBounds) {
    position.right = `${boundaries.width - x + offset}px`;
  } else {
    position.left = `${x + offset}px`;
  }

  if (toShowNativeMenu || isVerticallyOutOfBounds) {
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

function wrapAction(item: GlobalStatesType["contextMenuItems"][number], event: MouseEvent): void {
  if ("action" in item) {
    const action: ActionKeyType = item.action;

    void ActionRegistry.execute(action, event);
  }
}
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
      <template
        v-for="item in globalStates?.contextMenuItems"
        :key="item.name"
      >
        <button
          :id="`__context-menu__entry-${item.name}`"
          @click="event => wrapAction(item, event)"
          class="__context_menu__entry __context-menu-disable relative flex flex-nowrap items-center gap-2 p-2 hover:bg-neutral-700"
        >
          <span
            v-if="item.icon"
            :id="`__context-menu__entry-${item.name}-icon`"
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
            :id="`__context-menu__entry-${item.name}-label`"
            class="__context-menu-disable block whitespace-nowrap text-sm leading-none"
          >
            {{ item.name }}
          </span>
          <MaterialRipple />
        </button>
        <ContextMenuChildren
          v-if="'children' in item"
          :id-root="`__context-menu__entry-${item.name}-pop-up`"
          :children="item.children"
        />
      </template>
    </div>
  </Transition>
</template>
