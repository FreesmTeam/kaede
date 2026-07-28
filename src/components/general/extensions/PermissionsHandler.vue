<script setup lang="ts">
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import AllowButton from "@/components/general/extensions/permissions/AllowButton.vue";
import { IgnoredExtensionPermissions } from "@/constants/permissions.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { __requestPermissions } from "@/lib/extensions-manager/scopes/request-permissions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

const requestedPermissionState = ref<{
  "id"       : PermissionType;
  "extension": string;
  "resolve"  : (state: boolean) => void;
} | undefined>(undefined);
const doNotAsk = ref<boolean>(false);

function handlePermissionRequest(
  permission?: PermissionType,
  extension?: string,
  resolve?: (state: boolean) => void,
): void {
  if (!permission || !extension || !resolve) {
    requestedPermissionState.value = undefined;

    return;
  }

  requestedPermissionState.value = {
    "id"       : permission,
    "extension": extension,
    "resolve"  : resolve,
  };
}

function requestPermissions(
  permissions: Array<PermissionType>,
  extension: string,
): Promise<Array<boolean>> {
  return __requestPermissions(permissions, extension, handlePermissionRequest);
}

function handleUserRequest(state: boolean): void {
  if (!requestedPermissionState.value) {
    return;
  }

  if (doNotAsk.value) {
    const _extension = requestedPermissionState.value.extension;
    const _permission = requestedPermissionState.value.id;

    if (!IgnoredExtensionPermissions[_extension]) {
      IgnoredExtensionPermissions[_extension] = {};
    }

    IgnoredExtensionPermissions[_extension][_permission] = state;
  }

  requestedPermissionState.value.resolve(state);
}

GlobalInternals.requestPermissions = requestPermissions;
</script>

<template>
  <Transition name="pop">
    <div
      v-if="requestedPermissionState"
      id="__extensions-loader__permission-request-wrapper"
      @contextmenu.prevent
      @contextmenu="ContextMenu.show"
      class="absolute bottom-0 left-0 right-0 top-0 z-8000 grid place-items-center bg-[theme(colors.black/.5)]"
    >
      <div
        @contextmenu.prevent
        id="__extensions-loader__permission-request-inner"
        class="max-w-72 w-full flex flex-col items-start gap-2 rounded-md bg-neutral-900 p-2"
      >
        <div
          id="__extensions-loader__permission-request-information"
          class="flex flex-nowrap gap-4 p-2 text-lg"
        >
          <div
            id="__extensions-loader__permission-request-information-icon"
            class="i-lucide-globe mt-1 size-5 shrink-0"
          ></div>
          <div
            id="__extensions-loader__permission-request-information-title"
            class="text-neutral-300"
          >
            <span
              id="__extensions-loader__permission-request-information-title-before"
            >
              Allow
            </span>
            <span
              id="__extensions-loader__permission-request-information-title-extension"
              class="text-white font-medium"
            >
              {{ requestedPermissionState.extension }}
            </span>
            <span
              id="__extensions-loader__permission-request-information-title-after"
            >
              to access {{ requestedPermissionState.id }}?
            </span>
          </div>
        </div>
        <div
          id="__extensions-loader__permission-request-ignore-wrapper"
          class="flex flex-nowrap items-center px-2"
        >
          <div
            id="__extensions-loader__permission-request-ignore-checkbox-wrapper"
            class="grid size-5 shrink-0 cursor-pointer place-items-center border-2 border-neutral-300 rounded-md"
          >
            <input
              id="__extensions-loader__permission-request-ignore-checkbox"
              type="checkbox"
              v-model="doNotAsk"
              class="size-3 cursor-pointer appearance-none rounded-sm bg-transparent transition-[background-color] duration-75 checked:bg-white"
            />
          </div>
          <label
            id="__extensions-loader__permission-request-ignore-label"
            for="__extensions-loader__permission-request-ignore-checkbox"
            class="cursor-pointer pl-4 text-neutral-300"
          >
            Don't ask again
          </label>
        </div>
        <div
          id="__extensions-loader__permission-request-control"
          class="w-full flex flex-nowrap items-center justify-end gap-2"
        >
          <AllowButton
            :on-click="() => handleUserRequest(true)"
          />
          <button
            id="__extensions-loader__permission-request-deny-wrapper"
            @click="() => handleUserRequest(false)"
            class="relative rounded-md bg-neutral-800 px-3 py-1"
          >
            <span
              id="__extensions-loader__permission-request-deny-label"
              class="text-white"
            >
              No
            </span>
            <MaterialRipple />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
