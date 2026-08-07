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
import { computed, inject, ref } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import CustomInput from "@/components/general/base/CustomInput.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { AuthStatesContextKey, TranslationsContextKey } from "@/constants/application.ts";
import Configs from "@/lib/configs";
import Hashing from "@/lib/hashing";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const opened = ref<boolean>(false);
const nickname = ref<string>("");

const placeholder = computed((): string => (
  Translations?.value?.Messages?.["profile.accounts.offline-nickname"] ?? "Nickname"
));

async function createOfflineAccount(): Promise<void> {
  const current: string = nickname.value.trim();

  if (accounts === undefined || current.length === 0) {
    return;
  }

  const account: AccountType = {
    "msa"    : null,
    "profile": {
      "uuid": await Hashing.hashOfflineNickname(current),
      "name": current,
      "type": "offline",
    },
    "skin": {
      "id"     : "",
      "data"   : "",
      "url"    : "",
      "variant": "classic",
    },
  };

  accounts.value = [
    account,
    // Just to avoid duplicates
    ...accounts.value.filter(({ profile }) => profile.uuid !== account.profile.uuid),
  ];

  await Configs.writeAccounts({ "accounts": accounts.value });

  cancel();
}

function cancel(): void {
  nickname.value = "";
  opened.value = false;
}
</script>

<template>
  <div id="__profile-page__sign-in-offline-wrapper" class="min-h-8 flex flex-col gap-2">
    <CustomButton
      v-if="!opened"
      id-root="__profile-page__sign-in-offline-button"
      icon="i-lucide-user-round"
      class="w-full"
      :on-click="() => opened = true"
      :label="Translations?.Messages?.['profile.accounts.add-offline'] ?? 'Offline'"
    />
    <div
      v-else
      id="__profile-page__sign-in-offline-form"
      class="flex flex-col gap-2"
    >
      <CustomInput
        autofocus
        id-root="__profile-page__sign-in-offline-input"
        icon="i-lucide-user-round"
        :class-names="{ 'wrapper': 'h-8 !w-full' }"
        :placeholder="placeholder"
        :debounce-time="0"
        :default-value="nickname"
        :on-input="value => nickname = value"
      />
      <div
        id="__profile-page__sign-in-offline-form-actions"
        class="flex flex-nowrap items-center gap-2"
      >
        <button
          id="__profile-page__sign-in-offline-confirm"
          @click="createOfflineAccount"
          :disabled="nickname.trim().length === 0"
          class="relative w-full flex flex-nowrap items-center justify-center gap-2 rounded-md p-2 transition-[filter] bg-[theme(colors.neutral.100/.1)] disabled:opacity-50"
        >
        <span
          id="__profile-page__sign-in-offline-confirm-icon"
          class="i-lucide-check block size-4 shrink-0"
        ></span>
          <MaterialRipple />
        </button>
        <button
          id="__profile-page__sign-in-offline-cancel"
          @click="cancel"
          class="relative w-full flex flex-nowrap items-center justify-center gap-2 rounded-md p-2 transition-[filter] bg-[theme(colors.neutral.100/.1)]"
        >
        <span
          id="__profile-page__sign-in-offline-cancel-icon"
          class="i-lucide-x block size-4 shrink-0"
        ></span>
          <MaterialRipple />
        </button>
      </div>
    </div>
  </div>
</template>