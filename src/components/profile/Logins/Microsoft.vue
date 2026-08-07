<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { inject } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { AuthStatesContextKey, TranslationsContextKey } from "@/constants/application.ts";
import Auth from "@/lib/auth";
import Configs from "@/lib/configs";
import { globalStates } from "@/states/global.ts";
import type { SignInResultType, SignInStatusType } from "@/types/auth/microsoft-auth.type.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const { styles } = useConfigColors();

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

async function handleSignIn(): Promise<void> {
  const status = globalStates.pages.profile;

  if (!status) {
    return;
  }

  if (globalStates.pages.profile.pending) {
    return;
  }

  status.pending = true;
  status.error = null;

  const result: SignInResultType = await Auth.signInWithMicrosoft({
    "onStatus": (current: SignInStatusType): void => {
      status.step = current;
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
    status.error = result.reason;
  }

  status.pending = false;
  status.step = null;
}
</script>

<template>
  <CustomButton
    id-root="__profile-page__sign-in-msa-button"
    class="w-full"
    :icon="globalStates.pages.profile.pending
      ? 'i-lucide-loader-circle animate-spin'
      : 'i-lucide-grid-2x2'"
    :disabled="globalStates.pages.profile.pending"
    :on-click="handleSignIn"
    :label="Translations?.Messages?.['profile.accounts.add-microsoft'] ?? 'Microsoft'"
  />
  <Teleport defer to="#__profile-page__accounts-title">
    <span
      v-if="globalStates.pages.profile.pending && globalStates.pages.profile.step"
      id="__profile-page__sign-in-status"
      class="text-sm"
      :style="styles.widgetSecondary"
    >
      ({{ Translations?.Messages?.[`profile.sign-in.status.${globalStates.pages.profile.step}`] }})
    </span>
      <span
        v-if="globalStates.pages.profile.error !== null"
        id="__profile-page__sign-in-error"
        class="text-sm text-red-400"
      >
      ({{ globalStates.pages.profile.error }})
    </span>
  </Teleport>
</template>
