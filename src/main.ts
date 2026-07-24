/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// UnoCSS essentials
import "virtual:uno.css";
// Resets all styles in a Tailwind-like way
import "@unocss/reset/tailwind.css";
// Custom styles
import "@/globals.css";
// Material You ripple effect essentials
import "m3ripple-vue/style.css";

import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationRootID } from "@/constants/application";
import { getASCIIArt } from "@/constants/ascii-art.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import { declareGlobalStates } from "@/states/global.ts";
import { declareInstanceStates } from "@/states/instance.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

const startTime = performance.now();

// The global object is accessed not only by extensions but by the application itself
Globals.declareGlobals();

// For a live preview: https://kaede-basement.github.io/kaede/
if (Browser.detectIsBrowser()) {
  // Handle Tauri API placeholders
  await Browser.handleTauriEnvironment();

  Browser.handleLogsFlush();
}

const { basic, parsed } = await General.getInitialState();
const baseDirectory = basic.baseDirectory;

// Caching
GlobalInternals.baseDirectory = baseDirectory;
GlobalInternals.portable = basic.portable;
GlobalInternals.joinDelimiter = basic.separator;
GlobalInternals.launcherVersion = basic.launcherVersion;
GlobalInternals.launchCount = basic.launchCount;

// Show a pretty ASCII art with the launcher name :3
log.info(
  __PRE_BUNDLED_FILENAME__,
  getASCIIArt(basic.portable, basic.launchCount),
);

const [
  config,
  accounts,
  translations,
  instances,
]: [
  ConfigType,
  Array<AccountType>,
  TranslationsType,
  InstanceStatesType,
] = await Promise.all([
  Configs.getSafe({ baseDirectory, "parsedFile": parsed.config }),
  Configs.getAccounts({ baseDirectory, "parsedFile": parsed.accounts }),
  Configs.getTranslations({ baseDirectory, "parsedFile": parsed.translations }),
  Instances.readStored({ baseDirectory, "parsedFile": parsed.instances }),
]);

// Define launcher's initial values at globals to make them accessible from anywhere
GlobalInternals.initialConfig = config;
GlobalInternals.initialTranslations = translations;
GlobalInternals.initialInstances = instances;

/*
 * Exposing account details to the global object
 * makes retrieving account tokens in extensions a bit easier,
 * so we will delete this field as soon as the app-scoped reactive state will be created
 */
GlobalInternals.temporaryAccounts = accounts;

/*
 * The global and instance states were declared outside the Vue instance,
 * so they require the value assigning at this point
 */
declareGlobalStates();
declareInstanceStates();

if (config.development?.enableDebugMode) {
  // Enabling debug mode means that debug-level messages will be logged
  DevelopmentModeHelpers.enableDebugMode(
    config.development,
  );
}

log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
  "Config contents",
  config,
));
log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
  "Instances metadata contents",
  instances,
));

log.debug(__PRE_BUNDLED_FILENAME__, "Creating a Vue instance");
const AppInstance = createApp(App);

// @ts-expect-error For testing purposes
window.__KAEDE__.appInstance = AppInstance;

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing Vue Query plugin");
AppInstance.use(VueQueryPlugin);

log.debug(
  __PRE_BUNDLED_FILENAME__,
  `Mounting an app instance to the DOM element (${ApplicationRootID})`,
);
AppInstance.mount(ApplicationRootID);

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing launcher");
await General
  .finalizeInitialization({ config, baseDirectory, startTime })
  .catch((error: unknown) => {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to initialize launcher:", Errors.prettify(error));
  });
