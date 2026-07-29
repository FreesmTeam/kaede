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
import { computed, provide } from "vue";

import DevelopmentMode from "@/components/general/development-mode/DevelopmentMode.vue";
import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import ExtensionsError from "@/components/general/errors/ExtensionsError.vue";
import GlobalError from "@/components/general/errors/GlobalError.vue";
import CssThemeLoader from "@/components/general/extensions/CssThemeLoader.vue";
import Layout from "@/components/general/layout/Layout.vue";
import Router from "@/components/general/layout/Router.vue";
import NonBundledClasses from "@/components/general/misc/NonBundledClasses.vue";
import LogViewer from "@/components/logging/LogViewer.vue";
import { TranslationsContextKey } from "@/constants/application.ts";
import { LazyExtensionLoader } from "@/extendable/component-registry.ts";
import { globalStates } from "@/states/global.ts";
import type {
  TranslationsStateType,
  TranslationsType,
} from "@/types/translations/translations.type.ts";

/**
 * Contains a computed translation state to pass down with the 'inject'.
 */
const translations = computed((): TranslationsType => globalStates.translations);

/**
 * Provides a reference to the instance-level reactive translations state
 * for all component children.
 */
provide<TranslationsStateType>(TranslationsContextKey, translations);
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout>
        <Router />

        <Transition name="pop">
          <LogViewer v-if="globalStates.logs.show" />
        </Transition>

        <DevelopmentMode />
        <NonBundledClasses />
      </Layout>
    </template>

    <template #error="{ currentError }">
      <GlobalError :error="currentError" />
    </template>
  </ErrorBoundary>

  <!-- Extension-level error boundary -->
  <ErrorBoundary>
    <template #default>
      <CssThemeLoader />
      <!--
        -- Loading this component triggers side-effects, such as:
        -- * defining 'Extensions', 'Permissions', and 'Txiki' at Window;
        -- * importing 'ses', 'ark-of-atrahasis', and 'serialize-javascript'.
        --
        -- Therefore, if one has disabled extensions,
        -- they will not have any extensions-related packages in their launcher
        -->
      <LazyExtensionLoader v-if="globalStates.extensions.enabled" />
    </template>

    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>
</template>
