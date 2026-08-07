<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import type { CustomButtonType } from "@/types/ui/custom-button.type.ts";

const {
  disabled,
  idRoot,
  label,
  icon,
  tooltip,
  onClick,
  invert,
  hide,
} = defineProps<CustomButtonType>();
</script>

<template>
  <button
    :id="`${idRoot}-wrapper`"
    @click="onClick"
    :disabled="disabled"
    :class="[
      hide === true ? 'hidden' : 'flex',
      invert ? 'invert' : '',
      'z-10 shrink-0 relative grid px-2 w-fit flex-nowrap gap-2 bg-[theme(colors.neutral.100/.1)]',
      'items-center h-8 place-items-center rounded-md transition-[opacity,filter]',
      'disabled:opacity-70',
    ]"
    :title="tooltip"
  >
    <span v-if="icon" :id="`${idRoot}-icon`" :class="[icon, 'shrink-0 block size-4']"></span>
    <span
      :id="`${idRoot}-label`"
      :class="[
        hide === 'sm'
          ? 'hidden sm:block'
          : hide === 'md' ? 'hidden md:block' : 'block',
      ]"
    >
      {{ label }}
    </span>
    <MaterialRipple :disabled="disabled" />
  </button>
</template>
