<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import type { LogButtonType } from "@/types/logging/log-button.type.ts";

const {
  icon,
  label,
  tooltip,
  onClick,
  invert,
  hideOnSm,
  hideOnMd,
  ids,
  hidden,
} = defineProps<LogButtonType>();
</script>

<template>
  <button
    :id="ids.wrapper"
    @click="onClick"
    :class="[
      hidden ? 'hidden' : 'flex',
      invert ? 'invert' : '',
      'z-10 shrink-0 relative grid px-2 w-fit flex-nowrap gap-2 bg-neutral-800',
      'items-center h-full place-items-center rounded-md transition-[filter]',
    ]"
    :title="tooltip"
  >
    <span v-if="icon" :id="ids.icon" :class="[icon, 'block size-4']"></span>
    <span
      v-if="ids?.label && label"
      :id="ids?.label"
      :class="[
        hideOnSm
          ? 'hidden sm:block'
          : hideOnMd ? 'hidden md:block' : 'block',
      ]"
    >
      {{ label }}
    </span>
    <MaterialRipple />
  </button>
</template>
