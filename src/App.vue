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
import { useEventListener } from "@vueuse/core";
import { computed, provide, watchEffect } from "vue";
import * as Vue from "vue";

import DevelopmentMode from "@/components/general/development-mode/DevelopmentMode.vue";
import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import ExtensionsError from "@/components/general/errors/ExtensionsError.vue";
import GlobalError from "@/components/general/errors/GlobalError.vue";
import CssThemeLoader from "@/components/general/extensions/CssThemeLoader.vue";
import ExtensionLoader from "@/components/general/extensions/ExtensionLoader.vue";
import CustomLayout from "@/components/general/layout/CustomLayout.vue";
import Layout from "@/components/general/layout/Layout.vue";
import Router from "@/components/general/layout/Router.vue";
import ConfigSyncer from "@/components/general/misc/ConfigSyncer.vue";
import NonBundledClasses from "@/components/general/misc/NonBundledClasses.vue";
import LogViewer from "@/components/logging/LogViewer.vue";
import { TranslationsContextKey } from "@/constants/application.ts";
import { registerComponent } from "@/extendable/component-registry.ts";
import Configs from "@/lib/configs";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type {
  TranslationsStateType,
  TranslationsType,
} from "@/types/translations/translations.type.ts";

// @ts-expect-error For testing purposes
window.__KAEDE__.vue = Vue;
// @ts-expect-error For testing purposes
window.__KAEDE__.registerComponent = (name: string, component: Vue.Component): void => {
  registerComponent(name, component);
};

/**
 * Contains a computed translation state to pass down with the 'inject'.
 */
const translations = computed((): TranslationsType => globalStates.translations);

/**
 * Provides a reference to the instance-level reactive translations state
 * for all component children.
 */
provide<TranslationsStateType>(TranslationsContextKey, translations);

/**
 * Handles 'F5', 'Ctrl+R', and 'Command+R' key binds that reload the launcher.
 */
useEventListener("keydown", (event: KeyboardEvent) => (
  DevelopmentModeHelpers.handleNativeReloadKeyBinds(
    event,
    globalStates.development?.enableNativeReloadKeyBinds,
  )
));

/**
 * Updates translations on locale change.
 */
watchEffect(() => {
  const baseDirectory: string = General.getCachedBaseDirectory();
  const locale: string = globalStates.layout.locale;

  log.debug(__PRE_BUNDLED_FILENAME__, `Overriding default translations to '${locale}'`);
  Configs.getTranslations(baseDirectory, locale).then(translations => {
    GlobalStateHelpers.change("translations", translations);
    log.info(__PRE_BUNDLED_FILENAME__, `Successfully set translations to '${locale}'`);
  });
});
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout
        v-if="globalStates.layout.custom !== true"
        :page="globalStates.pages.current"
        :to-show-sidebar="
          !Array.isArray(globalStates.layout.custom) ||
          !globalStates.layout.custom.includes('sidebar')
        "
        :to-show-context-menu="
          !Array.isArray(globalStates.layout.custom) ||
          !globalStates.layout.custom.includes('contextMenu')
        "
        :to-show-native-context-menu="globalStates.development?.enableNativeContextMenu ?? false"
      >
        <Router
          v-if="globalStates.pages.current !== 'none'"
          :page="globalStates.pages.current"
        />

        <Transition name="pop">
          <LogViewer v-if="globalStates.logs.show" />
        </Transition>

        <DevelopmentMode
          v-if="globalStates.development"
          :development="globalStates.development"
        />
        <NonBundledClasses />
      </Layout>
      <CustomLayout v-else />

      <ConfigSyncer />
    </template>

    <template #error="{ currentError }">
      <GlobalError :error="currentError" />
    </template>
  </ErrorBoundary>

  <!-- Extension-level error boundary -->
  <ErrorBoundary>
    <template #default>
      <CssThemeLoader />
      <ExtensionLoader v-if="globalStates.extensions.enabled" />
    </template>

    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>
</template>
