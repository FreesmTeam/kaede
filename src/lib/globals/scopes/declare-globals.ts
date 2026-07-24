import * as Vue from "vue";

import _Application from "@/constants/application.ts";
import _ASCIIArt from "@/constants/ascii-art.ts";
import _Browser from "@/constants/browser.ts";
import _EventListeners from "@/constants/event-listeners.ts";
import _FileStructure from "@/constants/file-structure.ts";
import _Hooks from "@/constants/hooks.ts";
import _Launcher from "@/constants/launcher.ts";
import _Meta from "@/constants/meta.ts";
import _Permissions from "@/constants/permissions.ts";
import _Routes from "@/constants/routes.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Globals from "@/lib/globals";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import Logging from "@/lib/logging";
import Schemas from "@/lib/schemas";
import Txiki from "@/lib/txiki";
import { getGlobalStates } from "@/states/global.ts";
import { getInstanceStates } from "@/states/instance.ts";

export function declareGlobals(): void {
  window.__KAEDE_INTERNALS__ = GlobalInternals;
  window.__KAEDE__ = GlobalObject;

  GlobalInternals.getGlobalStates = getGlobalStates;
  GlobalInternals.changeGlobalStates = GlobalStateHelpers.change;
  GlobalInternals.getInstanceStates = getInstanceStates;
  GlobalInternals.changeInstanceStates = Instances.change;

  GlobalObject.constants = {
    "Application"   : _Application,
    "ASCIIArt"      : _ASCIIArt,
    "Browser"       : _Browser,
    "EventListeners": _EventListeners,
    "FileStructure" : _FileStructure,
    "Hooks"         : _Hooks,
    "Launcher"      : _Launcher,
    "Meta"          : _Meta,
    "Permissions"   : _Permissions,
    "Routes"        : _Routes,
  };
  GlobalObject.libs = {
    Browser,
    Configs,
    DevelopmentModeHelpers,
    Errors,
    ExtensionsManager,
    General,
    GlobalStateHelpers,
    Globals,
    Instances,
    Launcher,
    Logging,
    Schemas,
    Txiki,
    "ContextMenu": {

      /* These fields will be overwritten later */
      "show" : (): void => {},
      "close": (): void => {},
    },
    "Pages": {

      /* These fields will be overwritten later */
      "mount"  : (): void => {},
      "unmount": (): void => {},
    },
  };
  GlobalObject.packages.vue = Vue;
}

export function revokeExtensionGlobals(): void {
  Reflect.deleteProperty(window, "__KAEDE__");
  Reflect.deleteProperty(window, "__KAEDE_INTERNALS__");
}
