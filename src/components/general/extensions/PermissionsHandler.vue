<script setup lang="ts">
import { computed, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import AllowButton from "@/components/general/extensions/permissions/AllowButton.vue";
import { ContextMenu } from "@/constants/application.ts";
import Permissions from "@/constants/permissions.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { __requestPermissions } from "@/lib/permissions/request-permissions.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

const requestedPermissionState = ref<{
  "id"       : PermissionType | string;
  "extension": string;
  "resolve"  : (state: boolean) => void;
} | undefined>(undefined);

const displayData = computed(() => {
  return Permissions.getPermissionDisplayData(requestedPermissionState.value?.id);
});

function handlePermissionRequest(
  permission?: PermissionType | string,
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
  // After all, this is the value provided by the extension
  permissions: unknown,
  extension: string,
): Promise<Array<unknown>> {
  return __requestPermissions(permissions, extension, handlePermissionRequest);
}

function handleUserRequest(state: boolean): void {
  if (!requestedPermissionState.value) {
    return;
  }

  const currentPermissions = globalStates.extensions.permissions;
  const _extension = requestedPermissionState.value.extension;
  const _permission = requestedPermissionState.value.id;

  if (!currentPermissions[_extension]) {
    currentPermissions[_extension] = {};
  }

  currentPermissions[_extension][_permission] = state;

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
        class="max-w-80 w-full flex flex-col items-start gap-2 rounded-md bg-neutral-900 p-2"
      >
        <div
          id="__extensions-loader__permission-request-information"
          class="flex flex-nowrap gap-4 p-2 text-lg"
        >
          <div
            id="__extensions-loader__permission-request-information-icon"
            :class="[
              displayData.icon,
              'mt-1 size-6 shrink-0',
            ]"
          ></div>
          <div
            id="__extensions-loader__permissions-request-information-column"
            class="flex flex-col gap-2"
          >
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
                to {{ displayData.label }}?
              </span>
            </div>
            <div
              id="__extensions-loader__permission-request-information-description"
              class="whitespace-pre-wrap text-base text-neutral-400"
            >
              {{ displayData.description }}
              (Permission: '{{ requestedPermissionState.id }}')
            </div>
          </div>
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
