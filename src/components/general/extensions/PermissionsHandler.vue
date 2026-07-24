<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import AllowButton from "@/components/general/extensions/permissions/AllowButton.vue";
import PermissionRequestList from
  "@/components/general/extensions/permissions/PermissionRequestList.vue";
import {
  getDynamicBatchDecisions,
  getPermissionRequestFingerprint,
  type PermissionPrompt,
  permissionPromptController,
  reconcileDynamicDraftDecisions,
} from "@/lib/extensions-manager/scopes/permission-prompts.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
const prompt = ref<PermissionPrompt>();
const rememberDecision = ref(false);
const dynamicDecisions = ref<Array<boolean | undefined>>([]);
let unsubscribe: (() => void) | undefined;

onMounted(() => {
  unsubscribe = permissionPromptController.subscribe(nextPrompt => {
    prompt.value = nextPrompt;
    rememberDecision.value = false;
    dynamicDecisions.value = nextPrompt?.kind === "dynamic"
      ? [...nextPrompt.rememberedDecisions]
      : [];
  });
});
onUnmounted(() => {
  unsubscribe?.();
});
watch(rememberDecision, remember => {
  if (remember && prompt.value?.kind === "dynamic") {
    dynamicDecisions.value = [...reconcileDynamicDraftDecisions(
      prompt.value.requests,
      dynamicDecisions.value,
    )];
  }
});

function decisionsAreComplete(
  decisions: ReadonlyArray<boolean | undefined>,
): decisions is ReadonlyArray<boolean> {
  return decisions.every((decision): decision is boolean => decision !== undefined);
}

function chooseDynamic(index: number, decision: boolean): void {
  if (
    prompt.value?.kind !== "dynamic" ||
    prompt.value.rememberedDecisions[index] !== undefined
  ) {
    return;
  }

  dynamicDecisions.value[index] = decision;

  if (rememberDecision.value) {
    const selectedRequest = prompt.value.requests[index];

    if (selectedRequest !== undefined) {
      const selectedFingerprint = getPermissionRequestFingerprint(selectedRequest);

      for (const [requestIndex, request] of prompt.value.requests.entries()) {
        if (
          prompt.value.rememberedDecisions[requestIndex] === undefined &&
          getPermissionRequestFingerprint(request) === selectedFingerprint
        ) {
          dynamicDecisions.value[requestIndex] = decision;
        }
      }
    }
  }

  if (decisionsAreComplete(dynamicDecisions.value)) {
    permissionPromptController.resolveDynamic(
      dynamicDecisions.value,
      rememberDecision.value,
    );
  }
}

function chooseDynamicBatch(decision: boolean): void {
  if (prompt.value?.kind !== "dynamic") {
    return;
  }

  const decisions = getDynamicBatchDecisions(
    prompt.value.rememberedDecisions,
    decision,
  );

  permissionPromptController.resolveDynamic(decisions, rememberDecision.value);
}

function chooseStatic(decision: boolean): void {
  permissionPromptController.resolveStatic(decision);
}
</script>

<template>
  <Transition name="pop">
    <div
      v-if="prompt"
      id="__extensions-loader__permission-request-wrapper"
      :data-permission-prompt-kind="prompt.kind"
      @contextmenu.prevent
      @contextmenu="GlobalStateHelpers.showContextMenu"
      class="absolute bottom-0 left-0 right-0 top-0 z-8000 grid place-items-center overflow-y-auto p-4 bg-[theme(colors.black/.65)]"
    >
      <section
        id="__extensions-loader__permission-request-inner"
        :data-principal-key="prompt.principalKey"
        @contextmenu.prevent
        class="max-h-full max-w-xl w-full flex flex-col gap-3 overflow-y-auto rounded-md bg-neutral-900 p-4 shadow-xl"
      >
        <header
          id="__extensions-loader__permission-request-information"
          class="flex flex-nowrap gap-3"
        >
          <div
            id="__extensions-loader__permission-request-information-icon"
            class="i-lucide-shield-alert mt-1 size-5 shrink-0 text-amber-300"
          ></div>
          <div
            id="__extensions-loader__permission-request-information-title"
            class="min-w-0 flex flex-col gap-1"
          >
            <h2
              id="__extensions-loader__permission-request-heading"
              class="text-lg text-white font-medium"
            >
              {{ prompt.kind === "static" ? "Run plugin?" : "Permission request" }}
            </h2>
            <p
              id="__extensions-loader__permission-request-summary"
              class="text-sm text-neutral-300"
            >
              <span
                id="__extensions-loader__permission-request-plugin-id"
                class="text-white font-medium"
              >
                {{ prompt.principal.pluginId }}
              </span>
              {{ prompt.kind === "static"
                ? " requests this complete permission set before any plugin code runs."
                : " is requesting capabilities while it is running." }}
            </p>
          </div>
        </header>
        <dl
          id="__extensions-loader__permission-request-artifact"
          class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-neutral-950 p-3 text-xs"
        >
          <dt id="__extensions-loader__permission-request-source-label" class="text-neutral-400">
            Source
          </dt>
          <dd
            id="__extensions-loader__permission-request-source"
            class="truncate text-neutral-200"
            :title="prompt.principal.repositoryOrigin"
          >
            {{ prompt.principal.repositoryOrigin }}
          </dd>
          <dt id="__extensions-loader__permission-request-version-label" class="text-neutral-400">
            Version
          </dt>
          <dd id="__extensions-loader__permission-request-version" class="text-neutral-200">
            {{ prompt.principal.version }}
          </dd>
          <dt id="__extensions-loader__permission-request-hash-label" class="text-neutral-400">
            SHA-256
          </dt>
          <dd
            id="__extensions-loader__permission-request-hash"
            class="text-neutral-200 font-mono"
            :title="prompt.principal.artifactSha256"
          >
            {{ prompt.principal.artifactSha256.slice(0, 12) }}…
          </dd>
        </dl>
        <PermissionRequestList
          :prompt="prompt"
          :dynamic-decisions="dynamicDecisions"
          :on-choose-dynamic="chooseDynamic"
        />

        <div
          v-if="prompt.kind === 'dynamic'"
          id="__extensions-loader__permission-request-remember-wrapper"
          class="flex flex-nowrap items-center"
        >
          <input
            id="__extensions-loader__permission-request-remember-checkbox"
            v-model="rememberDecision"
            type="checkbox"
            class="size-4 cursor-pointer rounded-sm accent-white"
          />
          <label
            id="__extensions-loader__permission-request-remember-label"
            for="__extensions-loader__permission-request-remember-checkbox"
            class="cursor-pointer pl-3 text-sm text-neutral-300"
          >
            Remember for this exact plugin artifact and permission scope
          </label>
        </div>

        <footer
          id="__extensions-loader__permission-request-control"
          class="w-full flex flex-nowrap items-center justify-end gap-2"
        >
          <template v-if="prompt.kind === 'static'">
            <button
              id="__extensions-loader__permission-request-cancel-wrapper"
              data-permission-action="cancel"
              @click="chooseStatic(false)"
              class="relative rounded-md bg-neutral-800 px-3 py-1 text-white"
            >
              Cancel
              <MaterialRipple />
            </button>
            <AllowButton
              :key="prompt.fingerprint"
              id-suffix="static-run"
              label="Run"
              :on-click="() => chooseStatic(true)"
            />
          </template>
          <template v-else>
            <button
              id="__extensions-loader__permission-request-deny-all-wrapper"
              data-permission-action="deny-all"
              @click="chooseDynamicBatch(false)"
              class="relative rounded-md bg-neutral-800 px-3 py-1 text-white"
            >
              Deny all
              <MaterialRipple />
            </button>
            <AllowButton
              :key="`${prompt.fingerprint}:allow-all`"
              id-suffix="dynamic-all"
              label="Allow all"
              :on-click="() => chooseDynamicBatch(true)"
            />
          </template>
        </footer>
      </section>
    </div>
  </Transition>
</template>
