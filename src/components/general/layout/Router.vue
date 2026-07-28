<script setup lang="ts">
import { getComponents } from "@/extendable/component-registry.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

const C = getComponents();
</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full">
    <C.GlobalBackground />
    <Transition name="page">
      <C.PagesSelector :page="page" />
    </Transition>
  </div>
</template>
