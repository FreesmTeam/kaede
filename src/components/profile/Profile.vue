<script setup lang="ts">
import { createSkinViewer, use } from "@daidr/minecraft-skin-renderer";
import { WebGLRendererPlugin } from "@daidr/minecraft-skin-renderer/webgl";
import { inject, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  AuthStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application.ts";
import { C } from "@/extendable/component-registry.ts";
import Auth from "@/lib/auth";
import Configs from "@/lib/configs";
import type {
  SignInResultType,
  SignInStatusType,
} from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

/*
 * The Steve that is shown when there are no accounts
 * or the selected account has no skins
 */
const FallbackSkin: string =
  "https://minecraft.wiki/images/Steve_%28classic_texture%29_JE6.png?8aa86";

const canvas = useTemplateRef("canvas");

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const status = ref<string>("loading");
const signingIn = ref<boolean>(false);
const signInStatus = ref<SignInStatusType | null>(null);
const signInError = ref<string | null>(null);

let viewer: Awaited<ReturnType<typeof createSkinViewer>> | undefined;

function getSkinSource(account?: AccountType): string | Blob {
  if (!account) {
    return FallbackSkin;
  }

  if (account.skin.data.length > 0) {
    const decoded: string = atob(account.skin.data);
    const bytes: Uint8Array = Uint8Array.from(decoded, character => (
      character.codePointAt(0) ?? 0
    ));

    return new Blob([bytes], { "type": "image/png" });
  }

  if (account.skin.url.length > 0) {
    return account.skin.url;
  }

  return FallbackSkin;
}

async function handleSignIn(): Promise<void> {
  if (signingIn.value) {
    return;
  }

  signingIn.value = true;
  signInError.value = null;

  const result: SignInResultType = await Auth.signInWithMicrosoft({
    "onStatus": (current: SignInStatusType): void => {
      signInStatus.value = current;
    },
  });

  if (result.success && accounts !== undefined) {
    // A re-login of an existing account updates it
    accounts.value = [
      result.account,
      ...accounts.value.filter(({ profile }) => (
        profile.uuid !== result.account.profile.uuid
      )),
    ];

    await Configs.writeAccounts({ "accounts": accounts.value });
  }

  if (!result.success) {
    signInError.value = result.reason;
  }

  signingIn.value = false;
  signInStatus.value = null;
}

async function removeAccount(uuid: string): Promise<void> {
  if (accounts === undefined) {
    return;
  }

  accounts.value = accounts.value.filter(({ profile }) => profile.uuid !== uuid);

  await Configs.writeAccounts({ "accounts": accounts.value });
}

onMounted(async () => {
  if (!canvas.value) {
    return;
  }

  use(WebGLRendererPlugin);

  viewer = await createSkinViewer({
    "canvas": canvas.value,
    "skin"  : getSkinSource(accounts?.value[0]),
    "slim"  : accounts?.value[0]?.skin.variant === "slim",
  });

  viewer.startRenderLoop();

  status.value = "done";
});

onUnmounted(() => {
  viewer?.dispose();
  viewer = undefined;
});

watch(
  () => accounts?.value[0],
  async (account?: AccountType): Promise<void> => {
    if (!viewer) {
      return;
    }

    await viewer.setSkin(getSkinSource(account));
    viewer.setSlim(account?.skin.variant === "slim");
  },
);
</script>

<template>
  <C.PageWrapper>
    <div
      id="__profile-page__wrapper"
      class="flex flex-wrap gap-8 p-4"
    >
      <div
        id="__profile-page__skin-wrapper"
        class="flex shrink-0"
      >
        <canvas ref="canvas" id="__profile-page__skin-canvas" width="300" height="400" />
      </div>
      <div
        id="__profile-page__accounts-wrapper"
        class="min-w-64 flex flex-col gap-2"
      >
        <span
          id="__profile-page__accounts-title"
          class="text-lg font-medium"
        >
          {{ Translations?.Messages?.["profile.accounts.title"] }}
        </span>
        <span
          v-if="(accounts?.length ?? 0) === 0"
          id="__profile-page__accounts-empty"
          class="text-sm text-neutral-400"
        >
          {{ Translations?.Messages?.["profile.accounts.empty"] }}
        </span>
        <div
          v-for="account of accounts ?? []"
          :key="account.profile.uuid"
          :id="`__profile-page__account-${account.profile.uuid}`"
          class="flex items-center gap-2 rounded-md p-2 bg-[theme(colors.neutral.100/.05)]"
        >
          <span
            :id="`__profile-page__account-${account.profile.uuid}-name`"
            class="font-medium"
          >
            {{ account.profile.name }}
          </span>
          <span
            :id="`__profile-page__account-${account.profile.uuid}-type`"
            class="text-xs text-neutral-400"
          >
            {{ account.profile.type }}
          </span>
          <button
            :id="`__profile-page__account-${account.profile.uuid}-remove`"
            @click="removeAccount(account.profile.uuid)"
            class="relative ml-auto rounded-md p-1 transition-[background-color] hover:bg-[theme(colors.neutral.100/.1)]"
            :title="Translations?.Messages?.['profile.accounts.remove']"
          >
            <span
              :id="`__profile-page__account-${account.profile.uuid}-remove-icon`"
              class="i-lucide-trash-2 block size-4"
            ></span>
          </button>
        </div>
        <button
          id="__profile-page__sign-in-button"
          @click="handleSignIn"
          :disabled="signingIn"
          class="relative w-fit flex flex-nowrap items-center gap-2 rounded-md bg-neutral-800 p-2 transition-[filter] disabled:opacity-50"
        >
          <span
            id="__profile-page__sign-in-button-icon"
            :class="[
              signingIn ? 'i-lucide-loader-circle animate-spin' : 'i-lucide-user-plus',
              'block size-4',
            ]"
          ></span>
          <span id="__profile-page__sign-in-button-label" class="block">
            {{ Translations?.Messages?.["profile.accounts.add-microsoft"] }}
          </span>
          <MaterialRipple />
        </button>
        <span
          v-if="signingIn && signInStatus !== null"
          id="__profile-page__sign-in-status"
          class="text-sm text-neutral-400"
        >
          {{ Translations?.Messages?.[`profile.sign-in.status.${signInStatus}`] }}
        </span>
        <span
          v-if="signInError !== null"
          id="__profile-page__sign-in-error"
          class="text-sm text-red-400"
        >
          {{ signInError }}
        </span>
      </div>
    </div>
  </C.PageWrapper>
</template>
