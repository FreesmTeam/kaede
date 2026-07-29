<script setup lang="ts">
import { useInterval } from "@vueuse/core";
import { onMounted, onUnmounted, ref, shallowRef } from "vue";

// This variable will determine whether to stop counting FPS
const aborted = ref<boolean>(false);

// If I make these variables non-reactive, somehow Vue still tracks them (???)
const limits = shallowRef<{
  "max"    : number;
  "current": number;
  "latency": string;
  "peak"   : string;
}>({
  // Define 60 as the standard value
  "max"    : 60,
  "current": 0,
  "latency": "0",
  "peak"   : "16.7",
});
const frames = shallowRef<Array<number>>([]);
const times = shallowRef<Array<number>>([]);

// The FPS graph will re-render 50 times per second
const key = useInterval(20);

onMounted(() => {
  function countFrame(): void {
    if (aborted.value) {
      return;
    }

    requestAnimationFrame(() => {
      const now = performance.now();

      while (times.value.length > 0 && times.value[0] <= now - 1000) {
        times.value.shift();

        // Change a reactive variable **without** triggering Vue reactivity
        frames.value.shift();
      }

      times.value.push(now);

      const currentLatency = (
        times.value[times.value.length - 1] -
        times.value[times.value.length - 2]
      );

      // Change reactive variables **without** triggering Vue reactivity
      frames.value.push(times.value.length);
      limits.value.current = times.value.length;
      limits.value.max = Math.max(limits.value.max, times.value.length);
      limits.value.latency = currentLatency.toFixed(1);
      limits.value.peak = Math.max(
        Number.parseFloat(limits.value.peak),
        currentLatency || 16.7,
      ).toFixed(1);

      countFrame();
    });
  }

  countFrame();
});
onUnmounted(() => {
  // We do NOT want to count FPS when the component is not shown
  aborted.value = true;
});
</script>

<template>
  <div
    id="__dev-fps-counter__wrapper"
    class="flex flex-col items-end gap-2 bg-black p-2 opacity-50"
  >
    <div
      :key="key"
      id="__dev-fps-counter__counter-container"
      class="w-full flex flex-nowrap justify-between gap-4 text-sm text-white font-mono"
    >
      <p id="__dev-fps-counter__counter-current">
        {{ limits.current }} FPS
      </p>
      <p id="__dev-fps-counter__counter-max">
        {{ limits.max }} peak
      </p>
    </div>
    <!-- Attaching a reactive key to the peer element somehow affects all element peers (?) -->
    <div
      id="__dev-fps-counter__lines-container"
      class="box-content h-fit w-60 flex flex-nowrap justify-start border"
    >
      <!-- Display only 15 last frames -->
      <div
        v-for="(frame, index) in frames.slice(-15)"
        :key="`${frame}-${index}`"
        :id="`__dev-fps-counter__line-${index}`"
        class="h-15 w-4 bg-red"
        :style="{
          filter: `hue-rotate(${frame / limits.max * 140}deg)`,
        }"
      ></div>
    </div>
    <div
      id="__dev-fps-counter__latency-container"
      class="w-full flex flex-nowrap justify-between gap-4 text-sm text-white font-mono"
    >
      <p id="__dev-fps-counter__latency-current">
        {{ limits.latency }} ms
      </p>
      <p id="__dev-fps-counter__latency-current">
        {{ limits.peak }} peak
      </p>
    </div>
  </div>
</template>
