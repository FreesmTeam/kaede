<script setup lang="ts">
import { inject, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useSkinRenderer } from "@/composables/use-skin-renderer.ts";
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
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const { styles } = useConfigColors();
const { canvas, viewer, shown } = useSkinRenderer({ "render": "3d" });

const signingIn = ref<boolean>(false);
const signInStatus = ref<SignInStatusType | null>(null);
const signInError = ref<string | null>(null);

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
</script>

<template>
  <C.PageWrapper>
    <div
      id="__profile-page__wrapper"
      class="w-full flex flex-col gap-2 py-2 pr-2"
    >
      <div
        id="__profile-page__inner"
        class="flex flex-wrap gap-8 rounded-md"
        :style="styles.widget"
      >
        <div
          id="__profile-page__skin-wrapper"
          class="flex shrink-0"
        >
          <!--
            -- Transitioning visibility declaratively here just works sluggishly,
            -- so we do it imperatively in 'use-skin-renderer' to avoid white screen flashing
            --
            -- UPD: not anymore, now we simply dispose the previous viewer on the new viewer render
            -->
          <canvas
            ref="canvas"
            id="__profile-page__skin-canvas"
            width="150"
            height="225"
            @pointerover="() => viewer?.playAnimation?.('walk')"
            @pointerleave="() => viewer?.stopAnimation?.()"
            :class="[
              shown ? 'opacity-100' : 'opacity-0',
              'cursor-grab duration-300 transition-[opacity] active:cursor-grabbing',
            ]"
          />
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
            class="text-sm"
            :style="styles.widgetSecondary"
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
              class="text-xs"
              :style="styles.widgetSecondary"
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
            class="relative w-fit flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[filter] bg-[theme(colors.neutral.100/.1)] disabled:opacity-50"
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
            class="text-sm"
            :style="styles.widgetSecondary"
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
    </div>
  </C.PageWrapper>
</template>
