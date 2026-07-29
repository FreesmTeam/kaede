import { cancel, onInvalidUrl, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import DevelopmentMode from "src/lib/development-mode";
import * as Vue from "vue";

import _Application, { ContextMenu } from "@/constants/application.ts";
import _ASCIIArt from "@/constants/ascii-art.ts";
import _Browser from "@/constants/browser.ts";
import _EventListeners from "@/constants/event-listeners.ts";
import _FileStructure from "@/constants/file-structure.ts";
import _Launcher from "@/constants/launcher.ts";
import _Meta from "@/constants/meta.ts";
import _Permissions from "@/constants/permissions.ts";
import _Routes from "@/constants/routes.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import type ExtensionAPI from "@/lib/extension-api";
import type Extensions from "@/lib/extensions";
import FileManager from "@/lib/file-manager";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Hashing from "@/lib/hashing";
import Hooks from "@/lib/hooks";
import Initialization from "@/lib/initialization";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import Logging from "@/lib/logging";
import Network from "@/lib/network";
import type Permissions from "@/lib/permissions";
import Processes from "@/lib/processes";
import Router from "@/lib/router";
import Schemas from "@/lib/schemas";
import type Txiki from "@/lib/txiki";
import Watchers from "@/lib/watchers";

export function declareGlobals(): void {
  window.__TAURI_PLUGINS_COMMUNITY__ = {
    "oauth2": {
      cancel,
      onInvalidUrl,
      onUrl,
      start,
    },
  };
  window.__KAEDE__ = GlobalObject;

  GlobalObject.constants = {
    "Application"   : _Application,
    "ASCIIArt"      : _ASCIIArt,
    "Browser"       : _Browser,
    "EventListeners": _EventListeners,
    "FileStructure" : _FileStructure,
    "Launcher"      : _Launcher,
    "Meta"          : _Meta,
    "Permissions"   : _Permissions,
    "Routes"        : _Routes,
  };
  GlobalObject.libs = {
    Browser,
    Configs,
    DevelopmentMode,
    Errors,
    FileManager,
    General,
    Globals,
    Hashing,
    Hooks,
    Initialization,
    Instances,
    Launcher,
    Logging,
    Network,
    Processes,
    Router,
    Schemas,
    Watchers,
    ContextMenu,
    "Pages": {

      /* These fields will be overwritten later */
      "mount"  : (): void => {},
      "unmount": (): void => {},
    },

    /*
     * Overwritten to proper utilities if extensions are enabled
     */
    "ExtensionAPI": {} as typeof ExtensionAPI,
    "Extensions"  : {} as typeof Extensions,
    "Permissions" : {} as typeof Permissions,
    "Txiki"       : {} as typeof Txiki,
  };
  GlobalObject.packages.vue = Vue;
}
