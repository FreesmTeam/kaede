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
import { computed, useTemplateRef } from "vue";

import ColorPicker from "@/components/general/base/ColorPicker.vue";
import CustomInput from "@/components/general/base/CustomInput.vue";
import CustomSelect from "@/components/general/base/CustomSelect.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import Radio from "@/components/general/base/Radio.vue";
import Row from "@/components/general/base/Row.vue";
import Toggle from "@/components/general/base/Toggle.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { globalStates } from "@/states/global.ts";
import type { SettingsRowType } from "@/types/ui/settings-row.type.ts";

const { row } = defineProps<{
  "row": SettingsRowType;
}>();

const selectReference = useTemplateRef<{ "open": () => void }>("select");
const inputReference = useTemplateRef<{
  "focus": () => void;
  "pick" : (event: Event) => void;
}>("input");
const colorReference = useTemplateRef<{ "open": () => void }>("color");

const { styles } = useConfigColors();

const interactiveKind = computed((): string | undefined => {
  if (!row.inner || Array.isArray(row.inner)) {
    return undefined;
  }

  return row.inner.kind;
});
const classNames = computed((): string | undefined => {
  if (row.disabled) {
    return "opacity-50";
  }

  if (row.onClick || interactiveKind.value !== undefined) {
    return "relative cursor-pointer";
  }

  return undefined;
});

function handleRowClick(event: MouseEvent): void {
  if (row.disabled) {
    return;
  }

  if (row.onClick !== undefined) {
    row.onClick(event);

    return;
  }

  switch (interactiveKind.value) {
    case "select": {
      selectReference.value?.open();

      break;
    }
    case "input": {
      inputReference.value?.focus();

      break;
    }
    case "color": {
      colorReference.value?.open();

      break;
    }
  }
}
</script>

<template>
  <Row
    :id-root="row.idRoot"
    :class="classNames"
    :separate="row.separate"
    :icon="row.icon"
    :image="row.image"
    :title="row.title"
    :subtitle="row.subtitle"
    @click="handleRowClick"
  >
    <Radio
      v-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'radio'"
      :id="`${row.idRoot}-radio`"
      :value="row.inner.value"
    />
    <Toggle
      v-else-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'toggle'"
      :id="`${row.idRoot}-toggle`"
      :value="row.inner.value"
    />
    <CustomSelect
      v-else-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'select'"
      ref="select"
      @click.stop
      :id-root="`${row.idRoot}-select`"
      :options="row.inner.options"
      :value="row.inner.value"
      :on-select="row.inner.onSelect"
      :class-names="{ 'wrapper': '!w-40 sm:!w-58' }"
    />
    <div
      :id="`${row.idRoot}-input-wrapper`"
      v-else-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'input'"
      class="flex shrink-0 flex-nowrap gap-2 !w-40 sm:!w-58"
    >
      <CustomInput
        ref="input"
        @click.stop
        :id-root="`${row.idRoot}-input`"
        :icon="row.inner.icon"
        :placeholder="row.inner.placeholder"
        :debounce-time="row.inner.debounceTime"
        :default-value="row.inner.defaultValue"
        :on-input="row.inner.onInput"
        :file-picker="row.inner.filePicker"
        :class-names="{
          'wrapper': row.inner.filePicker === undefined
            ? 'z-10 h-8 !w-full'
            : 'z-10 h-8 !w-30 sm:!w-48',
        }"
      />
      <button
        v-if="row.inner.filePicker"
        :id="`${row.idRoot}-input-file-picker-button`"
        :title="row.inner.filePicker.title ?? 'Pick a file'"
        class="relative z-10 grid size-8 shrink-0 place-items-center rounded-md transition-colors bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.15)]"
        @click="inputReference?.pick"
      >
        <span
          :id="`${row.idRoot}-input-file-picker-icon`"
          :class="[row.inner.filePicker.icon, 'block size-4']"
          :style="styles.widgetSecondary"
        ></span>
        <MaterialRipple />
      </button>
    </div>
    <ColorPicker
      v-else-if="row.inner && !Array.isArray(row.inner) && row.inner.kind === 'color'"
      ref="color"
      @click.stop
      :id-root="`${row.idRoot}-color`"
      :value="row.inner.value"
      :default-color="row.inner.default"
      :on-color="row.inner.onColor"
      :class-names="{ 'wrapper': 'w-full sm:!w-58' }"
      :to-bottom="row.inner.toBottom"
    />
    <MaterialRipple
      ref="rippleReference"
      v-if="!row.disabled && (row.onClick || interactiveKind !== undefined)"
    />
  </Row>

  <template v-if="Array.isArray(row.inner)">
    <SettingsRow v-if="row.empty && row.inner.length === 0" :row="row.empty" />
    <div
      v-for="childRow in row.inner"
      :key="childRow.idRoot"
      :id="`${childRow.idRoot}-padding`"
      class="flex flex-nowrap items-center gap-5 pl-5"
    >
      <div :id="`${childRow.idRoot}-divider`" class="grid h-8 place-items-center">
        <div
          :id="`${childRow.idRoot}-divider`"
          class="h-[1px] w-2"
          :style="{ 'background-color': globalStates.ui.widget.secondaryColor || '#d4d4d4' }"
        >
        </div>
      </div>
      <SettingsRow
        :row="childRow"
      />
    </div>
  </template>
</template>
