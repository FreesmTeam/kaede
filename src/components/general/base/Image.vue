<script setup lang="ts">
import { ref, type StyleValue, watch } from "vue";

import { Host } from "@/lib/capability-broker";
import { reportBackgroundBrokerError } from "@/lib/capability-broker/background-errors.ts";
import {
  createImageObjectUrl,
  storedImagePath,
  subscribeImageObjectUrl,
} from "@/lib/capability-broker/image-object-url.ts";

const { id, src, alt, classNames, style } = defineProps<{
  "id"         : string;
  "src"        : string;
  "alt"        : string;
  "classNames"?: string;
  "style"     ?: StyleValue;
}>();
const shown = ref<boolean>(false);
const resolvedSource = ref<string>(src);
const sourceRevision = ref(0);

async function updateStoredImageSource(
  source: string,
  storedPath: string,
  revision: number,
): Promise<void> {
  try {
    const nextSource = createImageObjectUrl(
      storedPath,
      await Host.files.readBytes(storedPath),
    );

    if (revision === sourceRevision.value) {
      resolvedSource.value = nextSource;
    }
  } catch (error: unknown) {
    if (revision === sourceRevision.value) {
      resolvedSource.value = "";
    }

    reportBackgroundBrokerError(`Could not load stored image: ${source}`, error);
  }
}

watch(() => src, (source, _previousSource, onCleanup) => {
  shown.value = false;
  const revision = ++sourceRevision.value;
  let storedPath: string | undefined;

  try {
    storedPath = storedImagePath(source);
  } catch (error: unknown) {
    resolvedSource.value = "";
    reportBackgroundBrokerError(`Could not load stored image: ${source}`, error);

    return;
  }

  if (storedPath === undefined) {
    resolvedSource.value = source;

    return;
  }

  const unsubscribe = subscribeImageObjectUrl(storedPath, nextSource => {
    sourceRevision.value += 1;
    shown.value = false;
    resolvedSource.value = nextSource;
  });

  onCleanup(unsubscribe);

  void updateStoredImageSource(source, storedPath, revision);
}, { "immediate": true });
</script>

<template>
  <img
    @load="shown = true"
    loading="lazy"
    :id="id"
    :alt="alt"
    :src="resolvedSource"
    :class="[
      'shrink-0 block transition-[opacity] duration-300',
      shown ? 'opacity-100' : '!opacity-0',
      classNames,
    ]"
    :style="style"
  />
</template>
