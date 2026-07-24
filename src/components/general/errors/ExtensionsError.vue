<script setup lang="ts">
import { computed, onMounted, type Ref } from "vue";

import { DirectHost } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";

const { error } = defineProps<{
  "error": Ref<
    NativeErrorType | undefined,
    NativeErrorType | undefined
  > | undefined;
}>();
const information = computed((): NativeErrorType => {
  return {
    "name"   : error?.value?.name || "Unknown",
    "message": error?.value?.message || "no message provided",
    "stack"  : error?.value?.stack || "No stacktrace?",
  };
});

onMounted(async () => {
  /*
   * Launcher's window is not visible by default
   * to prevent white screen flashing while webview has not loaded
   */
  if (globalStates?.misc?.showAfterExtensionsInitialization) {
    try {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        "User has enabled 'show-after-extensions-initialization';",
        "extensions loading has failed. Showing the webview now",
      );
      await DirectHost.showMainWebview();
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Failed to show the webview window after extensions initialization:",
        Errors.prettify(error),
      );
    }
  }
});
</script>

<template>
  <div id="__extension-error__wrapper" class="min-h-vh w-full flex flex-col select-text gap-4 bg-black p-20 text-white">
    <p id="__extension-error__message" class="text-xl font-light">
      {{ information.name }}: {{ information.message }}
    </p>
    <p id="__extension-error__stack" class="break-words text-sm text-neutral-300 font-light">
      {{ information.stack }}
    </p>
  </div>
</template>
