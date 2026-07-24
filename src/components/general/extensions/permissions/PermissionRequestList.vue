<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import AllowButton from "@/components/general/extensions/permissions/AllowButton.vue";
import {
  PERMISSION_CATALOG,
  type PermissionDangerLevel,
} from "@/constants/permissions.ts";
import type {
  PermissionTargetIdentity,
  PreparedPermissionRequest,
} from "@/lib/capability-broker";
import {
  getPermissionRequestId,
  type PermissionPrompt,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";

defineProps<{
  "prompt"          : PermissionPrompt;
  "dynamicDecisions": ReadonlyArray<boolean | undefined>;
  "onChooseDynamic" : (index: number, decision: boolean) => void;
}>();

function permissionDescription(request: PreparedPermissionRequest): string {
  return PERMISSION_CATALOG[getPermissionRequestId(request)].description;
}

function permissionDangerLevel(request: PreparedPermissionRequest): PermissionDangerLevel {
  return PERMISSION_CATALOG[getPermissionRequestId(request)].dangerLevel;
}

function permissionScope(request: PreparedPermissionRequest): string | undefined {
  return typeof request.descriptor === "string"
    ? undefined
    : JSON.stringify(request.descriptor.scope, null, 2);
}

function isDangerous(request: PreparedPermissionRequest): boolean {
  const dangerLevel = permissionDangerLevel(request);

  return dangerLevel === "critical" || dangerLevel === "high";
}

function requestElementId(index: number, element: string): string {
  return `__extensions-loader__permission-request-${element}-${index}`;
}

function targetElementId(
  requestIndex: number,
  targetIndex: number,
  element: string,
): string {
  return `__extensions-loader__permission-request-target-${element}-${requestIndex}-${targetIndex}`;
}

function targetStatus(identity: PermissionTargetIdentity): string {
  switch (identity.identityProvider) {
    case "desktop-filesystem-v1": {
      return "OS-confirmed filesystem identity";
    }
    case "desktop-executable-sha256-v1": {
      return "OS-confirmed executable identity and content digest";
    }
    case "browser-preview-logical-v1": {
      return "Browser preview logical identity — not OS-confirmed";
    }
    case "browser-preview-unsupported-v1": {
      return "Unsupported in browser preview — not OS-confirmed";
    }
  }
}

function targetPathLabel(identity: PermissionTargetIdentity): string {
  switch (identity.identityProvider) {
    case "desktop-filesystem-v1": {
      return "Canonical path";
    }
    case "desktop-executable-sha256-v1": {
      return "Canonical path";
    }
    case "browser-preview-logical-v1": {
      return "Logical storage key";
    }
    case "browser-preview-unsupported-v1": {
      return "Requested path";
    }
  }
}
</script>

<template>
  <ul
    id="__extensions-loader__permission-request-list"
    aria-label="Requested permissions"
    class="flex flex-col gap-2"
  >
    <li
      v-for="(request, index) in prompt.requests"
      :id="requestElementId(index, 'item')"
      :key="`${prompt.fingerprint}:${index}`"
      :data-permission-id="getPermissionRequestId(request)"
      :data-permission-danger="permissionDangerLevel(request)"
      class="flex flex-col gap-2 border rounded-md p-3"
      :class="isDangerous(request)
        ? 'border-red-700 bg-red-950/30'
        : 'border-neutral-700 bg-neutral-800/50'"
    >
      <div
        :id="requestElementId(index, 'item-heading')"
        class="flex flex-wrap items-center justify-between gap-2"
      >
        <code
          :id="requestElementId(index, 'id')"
          class="text-sm text-white"
        >
          {{ getPermissionRequestId(request) }}
        </code>
        <span
          :id="requestElementId(index, 'danger')"
          class="rounded px-2 py-0.5 text-xs uppercase"
          :class="isDangerous(request)
            ? 'bg-red-900 text-red-200'
            : 'bg-neutral-700 text-neutral-300'"
        >
          {{ permissionDangerLevel(request) }}
        </span>
      </div>
      <p
        :id="requestElementId(index, 'description')"
        class="text-sm text-neutral-300"
      >
        {{ permissionDescription(request) }}
      </p>
      <pre
        v-if="permissionScope(request)"
        :id="requestElementId(index, 'scope')"
        class="overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-xs text-neutral-300"
      >{{ permissionScope(request) }}</pre>

      <section
        v-if="request.targetIdentities.length > 0"
        :id="requestElementId(index, 'targets')"
        :aria-label="`Target identities for ${getPermissionRequestId(request)}`"
        class="flex flex-col gap-2"
      >
        <article
          v-for="(identity, targetIndex) in request.targetIdentities"
          :id="targetElementId(index, targetIndex, 'item')"
          :key="`${identity.kind}:${identity.path}:${targetIndex}`"
          :aria-labelledby="targetElementId(index, targetIndex, 'heading')"
          :data-target-kind="identity.kind"
          :data-target-identity-provider="identity.identityProvider"
          class="border border-neutral-700 rounded bg-neutral-950/70 p-2 text-xs"
        >
          <h3
            :id="targetElementId(index, targetIndex, 'heading')"
            class="text-sm text-white font-medium"
          >
            Target {{ targetIndex + 1 }} identity
          </h3>
          <p
            :id="targetElementId(index, targetIndex, 'status')"
            class="mt-1 text-neutral-300"
          >
            {{ targetStatus(identity) }}
          </p>
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] mt-2 gap-x-3 gap-y-1">
            <dt :id="targetElementId(index, targetIndex, 'kind-label')" class="text-neutral-400">
              Kind
            </dt>
            <dd
              :id="targetElementId(index, targetIndex, 'kind')"
              class="break-all text-neutral-200 font-mono"
            >{{ identity.kind }}</dd>
            <dt :id="targetElementId(index, targetIndex, 'provider-label')" class="text-neutral-400">
              Provider
            </dt>
            <dd
              :id="targetElementId(index, targetIndex, 'provider')"
              class="break-all text-neutral-200 font-mono"
            >{{ identity.identityProvider }}</dd>
            <dt :id="targetElementId(index, targetIndex, 'path-label')" class="text-neutral-400">
              {{ targetPathLabel(identity) }}
            </dt>
            <dd
              :id="targetElementId(index, targetIndex, 'path')"
              class="break-all text-neutral-200 font-mono"
            >{{ identity.path }}</dd>
            <template
              v-if="identity.identityProvider === 'desktop-filesystem-v1' ||
                identity.identityProvider === 'desktop-executable-sha256-v1'"
            >
              <dt :id="targetElementId(index, targetIndex, 'device-label')" class="text-neutral-400">
                Device
              </dt>
              <dd
                :id="targetElementId(index, targetIndex, 'device')"
                class="break-all text-neutral-200 font-mono"
              >{{ identity.device }}</dd>
              <dt :id="targetElementId(index, targetIndex, 'inode-label')" class="text-neutral-400">
                Inode
              </dt>
              <dd
                :id="targetElementId(index, targetIndex, 'inode')"
                class="break-all text-neutral-200 font-mono"
              >{{ identity.inode }}</dd>
            </template>
            <template v-if="identity.identityProvider === 'desktop-executable-sha256-v1'">
              <dt
                :id="targetElementId(index, targetIndex, 'content-sha256-label')"
                class="text-neutral-400"
              >
                Content SHA-256
              </dt>
              <dd
                :id="targetElementId(index, targetIndex, 'content-sha256')"
                class="break-all text-neutral-200 font-mono"
              >{{ identity.contentSha256 }}</dd>
            </template>
          </dl>
        </article>
      </section>

      <div
        v-if="prompt.kind === 'dynamic'"
        :id="requestElementId(index, 'controls')"
        class="flex items-center justify-end gap-2"
      >
        <span
          v-if="prompt.rememberedDecisions[index] !== undefined"
          :id="requestElementId(index, 'remembered')"
          class="mr-auto text-xs text-neutral-400"
        >
          Remembered: {{ prompt.rememberedDecisions[index] ? "Allow" : "Deny" }}
        </span>
        <span
          v-else-if="dynamicDecisions[index] !== undefined"
          :id="requestElementId(index, 'selected')"
          class="mr-auto text-xs text-neutral-400"
        >
          Selected: {{ dynamicDecisions[index] ? "Allow" : "Deny" }}
        </span>
        <template v-if="prompt.rememberedDecisions[index] === undefined">
          <button
            :id="requestElementId(index, 'deny')"
            data-permission-action="deny"
            @click="onChooseDynamic(index, false)"
            class="relative rounded-md bg-neutral-800 px-3 py-1 text-white"
          >
            Deny
            <MaterialRipple />
          </button>
          <AllowButton
            :key="`${prompt.fingerprint}:allow:${index}`"
            :id-suffix="`item-${index}`"
            label="Allow"
            :on-click="() => onChooseDynamic(index, true)"
          />
        </template>
      </div>
    </li>
  </ul>
</template>
