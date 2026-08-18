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
import { message as notify } from "@tauri-apps/plugin-dialog";
import { computed, inject, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useSkinRenderer } from "@/composables/use-skin-renderer.ts";
import {
  AccountActions,
  AuthStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Errors from "@/lib/errors";
import { globalStates } from "@/states/global.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";
import type {
  AccountActionHandlersType,
  AccountActionType,
} from "@/types/ui/account-action.type.ts";

const { idRoot, account, index } = defineProps<{
  "idRoot" : string;
  "account": AccountType;
  "index"  : number;
}>();

const statuses = ref<Record<string, "pending" | "success" | undefined>>({});

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const accountReference = computed((): AccountType => {
  return account;
});

const Translations = inject<TranslationsStateType>(TranslationsContextKey);

const { styles } = useConfigColors();
const { canvas, shown } = useSkinRenderer({
  "render" : "2d-head",
  "account": accountReference,
});

const selected = computed((): boolean => globalStates.selected.account === index);
const provider = computed((): string | undefined => {
  const messages = Translations?.value?.Messages;

  return account.profile.type === "msa"
    ? messages?.["profile.accounts.type.microsoft"]
    : messages?.["profile.accounts.type.offline"];
});

/**
 * Action labels are translation keys, but extensions may pass plain text,
 * so an unknown key is rendered as-is
 */
function translateLabel(label: string): string {
  const messages: Record<string, string> = Translations?.value?.Messages ?? {};

  return messages[label] ?? label;
}

function handleSelection(): void {
  globalStates.selected.account = index;
}

async function wrapAction(event: MouseEvent, entry: AccountActionType): Promise<void> {
  const handlers: AccountActionHandlersType = {
    "reset": () => {
      statuses.value[entry.label] = undefined;
    },
    "pending": () => {
      statuses.value[entry.label] = "pending";
    },
    "success": () => {
      statuses.value[entry.label] = "success";

      setTimeout(() => {
        handlers.reset();
      }, 1000);
    },
    "error": (message, error) => {
      void notify(
        `An error (${message}) occurred:\n${Errors.prettify(error)}`,
        { "title": "Accounts", "kind": "error" },
      );
    },
  };

  try {
    const result: boolean = await ActionRegistry.execute(
      entry.action,
      { event, account, handlers, accounts },
    );

    if (!result) {
      handlers.error(`Failed to run the action for '${entry.label}'`);
    }
  } catch (error: unknown) {
    handlers.error(`Failed to run the action for '${entry.label}':`, error);
  }
}
</script>

<template>
  <div
    :id="`${idRoot}-wrapper`"
    :class="[
      selected ? 'bg-[theme(colors.neutral.100/.1)]' : 'hover:bg-[theme(colors.neutral.100/.05)]',
      'relative w-full flex flex-nowrap items-center gap-2 rounded-md p-2',
      'transition-[background-color]',
    ]"
  >
    <button
      :id="idRoot"
      @click="handleSelection"
      :disabled="selected"
      :title="account.profile.name"
      class="absolute bottom-0 left-0 right-0 top-0 size-full rounded-md"
      :aria-label="account.profile.name"
    >
      <MaterialRipple :id="`${idRoot}-overlay`" :label="account.profile.name" />
    </button>
    <div
      :id="`${idRoot}-avatar-wrapper`"
      class="pointer-events-none grid size-8 shrink-0 place-items-center"
    >
      <canvas
        ref="canvas"
        :id="`${idRoot}-avatar`"
        :class="[
          shown ? 'opacity-100' : 'opacity-0',
          'size-8 rounded-md duration-300 transition-[opacity]',
        ]"
      />
    </div>
    <div
      :id="`${idRoot}-information`"
      class="pointer-events-none flex flex-col"
    >
      <span
        :id="`${idRoot}-name`"
        class="line-clamp-1 break-all text-sm"
        :style="{ 'color': styles.widget.color }"
      >
        {{ account.profile.name }}
      </span>
      <span
        :id="`${idRoot}-type`"
        class="line-clamp-1 break-all text-xs leading-none"
        :style="styles.widgetSecondary"
      >
        {{ provider }}
      </span>
    </div>
    <div
      :id="`${idRoot}-actions`"
      class="z-10 ml-auto flex shrink-0 flex-nowrap items-center gap-1"
    >
      <button
        v-for="(entry, entryIndex) of AccountActions"
        :id="`${idRoot}-action-${entryIndex}`"
        :key="`${entry.icon}-${entryIndex}`"
        @click="event => wrapAction(event, entry)"
        :disabled="statuses[entry.label] === 'pending' || entry.disabled?.(account)"
        :title="translateLabel(entry.label)"
        :aria-label="translateLabel(entry.label)"
        class="relative rounded-md p-1 transition-[background-color] disabled:bg-transparent disabled:opacity-50 hover:bg-[theme(colors.neutral.100/.1)]"
      >
        <span
          :id="`${idRoot}-action-${entryIndex}-icon`"
          :class="[
            statuses[entry.label] === 'pending'
              ? 'i-lucide-loader-circle animate-spin'
              : statuses[entry.label] === 'success'
                ? 'i-lucide-check'
                : entry.icon,
            'block size-4',
          ]"
        ></span>
      </button>
    </div>
  </div>
</template>
