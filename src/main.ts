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
import { ApplicationRootID, AuthOneTimeFetchContextKey } from "@/constants/application";
import ASCIIArt from "@/constants/ascii-art.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import Globals from "@/lib/globals";
import Initialization from "@/lib/initialization";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Watchers from "@/lib/watchers";
import { declareGlobalStates } from "@/states/global.ts";
import { declareInstanceStates } from "@/states/instance.ts";
import { declareServerProcesses } from "@/states/servers.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

log.info(
  __PRE_BUNDLED_FILENAME__,
  `Starting to execute 'main.ts' at time mark: ${performance.now().toFixed(1)} ms`,
);
Watchers.watchErrors();

// The global object is accessed not only by extensions but by the application itself
Globals.declareGlobals();

// For a live preview: https://kaede-basement.github.io/kaede/
if (Browser.detectIsBrowser()) {
  // Handle Tauri API placeholders
  await Browser.handleTauriEnvironment();

  Browser.handleLogsFlush();
}

const { basic, parsed } = await Initialization.start();
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
  ASCIIArt.getASCIIArt(basic.portable, basic.launchCount),
);

const [
  config,
  translations,
  instances,
  fetchAccounts,
]: [
  ConfigType,
  TranslationsType,
  InstanceStatesType,
  () => Array<AccountType>,
] = await Promise.all([
  Configs.getSafe({ baseDirectory, "parsedFile": parsed.config }),
  Configs.getTranslations({ baseDirectory, "parsedFile": parsed.translations }),
  Instances.readStored({ baseDirectory, "parsedFile": parsed.instances }),

  /*
   * Variables returned from this 'Promise#all' are globally visible,
   * and exposing user accounts like that feels bad (even though
   * anyone can use 'Configs#getAccounts' to fetch accounts again),
   * so we return a one-time fetch function (for ContextProviders)
   */
  (async (): Promise<() => Array<AccountType>> => {
    const accounts: Array<AccountType> = await Configs.getAccounts({
      baseDirectory,
      "parsedFile": parsed.accounts,
    });
    let executed: boolean = false;

    return function () {
      if (!executed) {
        executed = true;

        return accounts;
      }

      // HMR might trigger this branch
      log.error(__PRE_BUNDLED_FILENAME__, "You cannot load accounts once more");

      return [];
    };
  })(),
]);

// Define launcher's initial values at globals to make them accessible from anywhere
GlobalInternals.initialConfig = config;
GlobalInternals.initialTranslations = translations;
GlobalInternals.initialInstances = instances;

/*
 * The global and instance states were declared outside the Vue instance,
 * so they require the value assigning at this point
 */
declareGlobalStates();
declareInstanceStates();

/*
 * They handle the necessary watching actions.
 * For example, if 'enableDebugMode' is true, they allow debug messages to be logged
 */
Watchers.watchConfigSync();
Watchers.watchDevelopmentStates();
Watchers.watchLocaleStates();
Watchers.watchProcesses()
  .then(() => declareServerProcesses())
  .then(() => {
    log.info(__PRE_BUNDLED_FILENAME__, "Successfully hydrated server processes state");
  })
  .catch((error: unknown) => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to attach a listener to server processes:",
      Errors.prettify(error),
    );
  });

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

AppInstance.provide(AuthOneTimeFetchContextKey, fetchAccounts);

// Expose the app instance so that plugins can register components, etc.
GlobalInternals.appInstance = AppInstance;

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing Vue Query plugin");
AppInstance.use(VueQueryPlugin);

log.debug(
  __PRE_BUNDLED_FILENAME__,
  `Mounting an app instance to the DOM element (${ApplicationRootID})`,
);
AppInstance.mount(ApplicationRootID);

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing launcher");
await Initialization
  .finish({ config, baseDirectory })
  .catch((error: unknown) => {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to initialize launcher:", Errors.prettify(error));
  });
