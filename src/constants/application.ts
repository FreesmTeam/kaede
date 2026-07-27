/* eslint-disable max-lines */
import {
  ApplicationName as _ApplicationName,
  AsyncFunction as _AsyncFunction,
  DefaultLocale,
} from "@/constants/application-primitives.ts";
import FileStructure from "@/constants/file-structure.ts";
import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { Host } from "@/lib/capability-broker";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import ATLauncherIcon from "@/resources/ATLauncherIcon.svg";
import CraftingTableIcon from "@/resources/CraftingTableIcon.webp";
import CurseForgeIcon from "@/resources/CurseForgeIcon.webp";
import FTBIcon from "@/resources/FTBIcon.svg";
import ModrinthIcon from "@/resources/ModrinthIcon.webp";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { TabSectionType } from "@/types/application/tab-section.type.ts";

export const ApplicationRootID = "#app";
export { ApplicationName, AsyncFunction } from "@/constants/application-primitives.ts";

export const TranslationsContextKey = Symbol();
export const AuthStatesContextKey = Symbol();
export const LaunchStatesContextKey = Symbol();
export const InstanceLogsContextKey = Symbol();
export const LaunchInstanceContextKey = Symbol();
export const CloseInstanceContextKey = Symbol();

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

export const DefaultGlobalStatesPagesStates: GlobalStatesType["pages"]["states"] = {
  "home"        : {},
  "library"     : {},
  "settings"    : { "tab": "general" },
  "add-instance": {

    /*
     * Preferably, we should not interfere with the customizable options
     * that were made purely for extensions. However, I wanted to use
     * these type of things so many times because it is simpler for me, lol
     */
    "customSettings": [
      {
        "input": {
          "onInput": (
            value: string,
            currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
          ): void => {
            if (!currentInstance) {
              return;
            }

            const jvmArguments: Array<string> =
              GlobalObject.libs.Launcher.Arguments.splitArguments(value);

            GlobalObject.libs.GlobalStateHelpers.Pages.addToState("add-instance", {
              "instance": {
                ...currentInstance,
                "add": {
                  ...currentInstance.add,
                  "jvmArguments": jvmArguments,
                },
              },
            });
          },
          "placeholder"  : "JVM arguments",
          "iconClassName": "i-lucide-braces",
          "defaultValue" : (): string | undefined => {
            const currentInstance =
              GlobalObject.libs.GlobalStateHelpers.Pages.getState("add-instance")?.instance;

            if (!currentInstance) {
              return GlobalObject.libs.Launcher.Arguments.joinArguments(
                DefaultInstanceSettings.add?.jvmArguments,
              );
            }

            return GlobalObject.libs.Launcher.Arguments.joinArguments(
              currentInstance.add.jvmArguments,
            );
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your JVM arguments here",
          "type"        : "text",
        },
      },
      {
        "input": {
          "onInput": (
            value: string,
            currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
          ): void => {
            if (!currentInstance) {
              return;
            }

            const gameArguments: Array<string> =
              GlobalObject.libs.Launcher.Arguments.splitArguments(value);

            GlobalObject.libs.GlobalStateHelpers.Pages.addToState("add-instance", {
              "instance": {
                ...currentInstance,
                "add": {
                  ...currentInstance.add,
                  "gameArguments": gameArguments,
                },
              },
            });
          },
          "placeholder"  : "Game arguments",
          "iconClassName": "i-lucide-gamepad-2",
          "defaultValue" : (): string | undefined => {
            const currentInstance =
              GlobalObject.libs.GlobalStateHelpers.Pages.getState("add-instance")?.instance;

            if (!currentInstance) {
              return GlobalObject.libs.Launcher.Arguments.joinArguments(
                DefaultInstanceSettings.add?.gameArguments,
              );
            }

            return GlobalObject.libs.Launcher.Arguments.joinArguments(
              currentInstance.add.gameArguments,
            );
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your game arguments here",
          "type"        : "text",
        },
      },
    ],
  },
  "none": {},
};
export const SettingsSections: Array<TabSectionType> = [
  {
    "id"  : "general",
    "name": "General",
    "icon": "i-lucide-sliders-horizontal",
  },
  {
    "id"  : "user-interface",
    "name": "User Interface",
    "icon": "i-lucide-paintbrush-vertical",
  },
  {
    "id"  : "minecraft",
    "name": "Minecraft",
    "icon": "i-lucide-box",
  },
  {
    "id"  : "java",
    "name": "Java",
    "icon": "i-lucide-coffee",
  },
  {
    "id"  : "extensions",
    "name": "Extensions",
    "icon": "i-lucide-blocks",
  },
  {
    "id"  : "plugin-playground",
    "name": "Plugin Playground",
    "icon": "i-lucide-square-terminal",
  },
];
export const InstanceCreationSections: Array<TabSectionType> = [
  {
    "id"   : "clean-minecraft",
    "name" : "Clean",
    "image": CraftingTableIcon,
  },
  {
    "id"   : "modrinth",
    "name" : "Modrinth",
    "image": ModrinthIcon,
  },
  {
    "id"   : "ftb-legacy",
    "name" : "FTB Legacy",
    "image": FTBIcon,
  },
  {
    "id"   : "curseforge",
    "name" : "CurseForge",
    "image": CurseForgeIcon,
  },
  {
    "id"   : "atlauncher",
    "name" : "ATLauncher",
    "image": ATLauncherIcon,
  },
];
export const ContextMenuItems = [
  {
    "name"  : "Restart UI",
    "icon"  : "i-lucide-rotate-ccw",
    "action": (): void => window.location.reload(),
  },
  {
    "name"  : "Show Logs",
    "icon"  : "i-lucide-bug",
    "action": (): void => {
      GlobalObject.libs.GlobalStateHelpers.Logs.toggle("show", true);
      GlobalObject.libs.ContextMenu.close();
    },
  },
  {
    "name"  : "Open Root Folder",
    "icon"  : "i-lucide-folder",
    "action": (): void => {
      const baseDirectory: string = GlobalObject.libs.General.getCachedBaseDirectory();

      GlobalObject.libs.ContextMenu.close();
      Host.opener.revealItem(
        GlobalObject.libs.General.cachedJoin(
          baseDirectory,
          FileStructure.Files.Config,
        ),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the config file in the explorer:",
          Errors.prettify(error),
        );

        Host.opener.revealItem(
          GlobalObject.libs.General.cachedJoin(baseDirectory),
        ).catch((revealError: unknown) => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(revealError),
          );
        });
      });
    },
  },
  {
    "name"  : "Open Instance Folder",
    "icon"  : "i-lucide-box",
    "action": (): void => {
      const currentInstanceId: string | null =
        GlobalObject.libs.GlobalStateHelpers.get().layout.currentInstance;
      const baseDirectory: string = GlobalObject.libs.General.getCachedBaseDirectory();

      GlobalObject.libs.ContextMenu.close();

      if (!currentInstanceId) {
        log.warn("No instance selected; revealing the root directory in explorer");
        Host.opener.revealItem(
          GlobalObject.libs.General.cachedJoin(
            baseDirectory,
            FileStructure.Folders.Instances.Path,
          ),
        ).catch((error: unknown) => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(error),
          );
        });

        return;
      }

      const minecraftDirectory: string = GlobalObject.libs.Instances.getMinecraftDirectory({
        "baseDirectory": baseDirectory,
        "instanceId"   : currentInstanceId,
      });

      Host.opener.revealItem(
        GlobalObject.libs.General.cachedJoin(minecraftDirectory),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the instance directory in the explorer:",
          Errors.prettify(error),
        );
      });
    },
  },
] as const;

export default {
  "AsyncFunction"  : _AsyncFunction,
  "ApplicationName": _ApplicationName,
  ApplicationRootID,
  DefaultLocale,
  TranslationsContextKey,
  AuthStatesContextKey,
  LaunchStatesContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  CloseInstanceContextKey,
  CSSThemeExtensions,
  DefaultGlobalStatesPagesStates,
  InstanceCreationSections,
  SettingsSections,
  ContextMenuItems,
} as const;
