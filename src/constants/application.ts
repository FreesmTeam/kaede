/* eslint-disable max-lines */
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import EnglishTranslations from "@/constants/english.json";
import FileStructure from "@/constants/file-structure.ts";
import Auth from "@/lib/auth";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/log.ts";
import ATLauncherIcon from "@/resources/ATLauncherIcon.svg";
import CraftingTableIcon from "@/resources/CraftingTableIcon.webp";
import CurseForgeIcon from "@/resources/CurseForgeIcon.webp";
import FTBIcon from "@/resources/FTBIcon.svg";
import ModrinthIcon from "@/resources/ModrinthIcon.webp";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { EnsureFreshResultType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { LogLevelType } from "@/types/logging/log-level.type.ts";
import type { AccountActionCollectionType } from "@/types/ui/account-action.type.ts";
import type { TabSectionType } from "@/types/ui/tab-section.type.ts";

export const ApplicationName = "Kaede";
export const ApplicationRootID = "#app";

export const CustomFontFamily = "kaede-custom-font";

export const DefaultLocale = "en";
export const DefaultLocaleName = EnglishTranslations.Info.Name;

export const TranslationsContextKey = Symbol();
export const AuthOneTimeFetchContextKey = Symbol();
export const AuthStatesContextKey = Symbol();
export const LaunchStatesContextKey = Symbol();
export const InstanceLogsContextKey = Symbol();
export const LaunchInstanceContextKey = Symbol();
export const CloseInstanceContextKey = Symbol();

/*
 * JavaScript allows 'AsyncFunction' constructors.
 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
 */
export const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

export const ContextMenu: {
  "show" : (event: MouseEvent) => void;
  "close": () => void;
} = {

  /* These fields will be overwritten later */
  "show" : () => {},
  "close": () => {},
};

export const AccountActions: AccountActionCollectionType = [
  {
    "icon"    : "i-lucide-refresh-cw",
    "label"   : "profile.accounts.refresh",
    // Offline accounts don't need to be refreshed
    "disabled": (account: AccountType): boolean => account.msa === null,
    "action"  : async ({ account, accounts, handlers }): Promise<void> => {
      // We use 'pending' only for time-consuming tasks
      handlers.pending();
      const result: EnsureFreshResultType = await Auth.ensureFreshAccount(account, true);

      if (result.status === "failed") {
        return handlers.error("Failed to refresh the account");
      }

      if (result.status === "fresh") {
        return handlers.success();
      }

      if (!accounts?.value) {
        return handlers
          .error("Failed to update stored accounts as received 'accounts' is undefined");
      }

      accounts.value = accounts.value.map(current => (
        current.profile.uuid === account.profile.uuid
          ? result.account
          : current
      ));

      await Configs.writeAccounts({
        "accounts": accounts.value,
      });

      handlers.success();
    },
  },
  {
    "icon"  : "i-lucide-copy",
    "label" : "profile.accounts.copy-uuid",
    "action": async ({ account, handlers }): Promise<void> => {
      await writeText(account.profile.uuid);

      handlers.success();
    },
  },
  {
    "icon"  : "i-lucide-trash-2",
    "label" : "profile.accounts.remove",
    "action": async ({ account, accounts, handlers }): Promise<void> => {
      handlers.pending();

      if (!accounts?.value) {
        return handlers.error("Failed to remove the account as received 'accounts' is undefined");
      }

      const toDelete: boolean = await confirm(
        `Do you really want to delete '${account.profile.name}'?`,
        "Accounts",
      );

      if (!toDelete) {
        return handlers.reset();
      }

      accounts.value = accounts.value.filter(({ profile }) => (
        profile.uuid !== account.profile.uuid
      ));

      await Configs.writeAccounts({
        "accounts": accounts.value,
      });

      handlers.success();
    },
  },
];

export const DefaultGlobalStatesPagesStates: GlobalStatesType["pages"] = {
  "home"    : {},
  "library" : { "selected": undefined },
  "settings": { "tab": "user-interface" },
  "profile" : {
    "pending": false,
    "step"   : null,
    "error"  : null,
  },
  "add-instance": {

    /*
     * Preferably, we should not interfere with the customizable options
     * that were made purely for extensions. However, I wanted to use
     * these type of things so many times because it is simpler for me, lol
     */
    "customSettings": [
      {
        "input": {
          "onInput": (value: string): void => {
            const currentState = globalStates.pages["add-instance"];

            if (!currentState.instance) {
              globalStates.pages["add-instance"].instance = Instances
                .extractSavedFromPages(currentState.instance, globalStates.minecraft);
            }

            if (currentState.instance) {
              currentState.instance.add.jvmArguments = Launcher.Arguments.splitArguments(value);
            }
          },
          "placeholder"  : "JVM arguments",
          "iconClassName": "i-lucide-braces",
          "defaultValue" : (): string | undefined => {
            const currentInstance = globalStates.pages["add-instance"].instance;

            if (!currentInstance) {
              return Launcher.Arguments.joinArguments(globalStates.minecraft.add?.jvmArguments);
            }

            return Launcher.Arguments.joinArguments(currentInstance.add.jvmArguments);
          },
          "debounceTime": 300,
          "tooltip"     : "Specify your JVM arguments here",
          "type"        : "text",
        },
      },
      {
        "input": {
          "onInput": (value: string): void => {
            const currentState = globalStates.pages["add-instance"];

            if (!currentState.instance) {
              globalStates.pages["add-instance"].instance = Instances
                .extractSavedFromPages(currentState.instance, globalStates.minecraft);
            }

            if (currentState.instance) {
              currentState.instance.add.gameArguments = Launcher.Arguments.splitArguments(value);
            }
          },
          "placeholder"  : "Game arguments",
          "iconClassName": "i-lucide-gamepad-2",
          "defaultValue" : (): string | undefined => {
            const currentInstance = globalStates.pages["add-instance"].instance;

            if (!currentInstance) {
              return Launcher.Arguments.joinArguments(globalStates.minecraft.add?.gameArguments);
            }

            return Launcher.Arguments.joinArguments(currentInstance.add.gameArguments);
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
    "id"   : "java",
    "name" : "Java",
    "icon" : "i-lucide-coffee",
    "await": () => Launcher.detectJavaInstallations(),
  },
  {
    "id"  : "extensions",
    "name": "Extensions",
    "icon": "i-lucide-blocks",
  },
  {
    "id"  : "development",
    "name": "Development",
    "icon": "i-lucide-construction",
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
export const ContextMenuItems: GlobalStatesType["contextMenuItems"] = [
  {
    "name"  : "Restart UI",
    "icon"  : "i-lucide-rotate-ccw",
    "action": (): void => window.location.reload(),
  },
  {
    "name"  : "Show Logs",
    "icon"  : "i-lucide-bug",
    "action": (): void => {
      globalStates.logs.show = true;

      ContextMenu.close();
    },
  },
  {
    "name"  : "Open Root Folder",
    "icon"  : "i-lucide-folder",
    "action": (): void => {
      const baseDirectory: string = FileManager.getBaseDirectory();

      ContextMenu.close();
      revealItemInDir(
        FileManager.join(
          baseDirectory,
          FileStructure.Files.Config,
        ),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the config file in the explorer:",
          Errors.prettify(error),
        );

        revealItemInDir(
          FileManager.join(baseDirectory),
        ).catch((error: unknown) => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(error),
          );
        });
      });
    },
  },
  {
    "name"  : "Open Instance Folder",
    "icon"  : "i-lucide-box",
    "action": (): void => {
      const currentInstanceId: string | null = globalStates.selected.currentInstance;
      const baseDirectory: string = FileManager.getBaseDirectory();

      ContextMenu.close();

      if (!currentInstanceId) {
        log.warn("No instance selected; revealing the root directory in explorer");
        revealItemInDir(
          FileManager.join(
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

      const { "instanceDirectory": minecraftDirectory } = Instances.getMinecraftDirectory({
        "baseDirectory": baseDirectory,
        "instanceId"   : currentInstanceId,
      });

      revealItemInDir(
        FileManager.join(minecraftDirectory),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the instance directory in the explorer:",
          Errors.prettify(error),
        );
      });
    },
  },
];

export const HookResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;
export const ExtraHookResponseStatus = {
  "ContinueLoop": "continue-hooks-loop",
} as const;

export const LogKindColors: Record<"time" | "message", string> = {
  "time"   : "text-neutral-400",
  "message": "text-neutral-300",
};
export const LogLevelColors: Record<LogLevelType, string> = {
  "TRACE": "text-neutral-500",
  "DEBUG": "text-neutral-300",
  "INFO" : "text-blue-300",
  "WARN" : "text-orange-300",
  "ERROR": "text-red-300",
};

export default {
  AsyncFunction,
  ApplicationName,
  ApplicationRootID,
  CustomFontFamily,
  DefaultLocale,
  DefaultLocaleName,
  TranslationsContextKey,
  AuthOneTimeFetchContextKey,
  AuthStatesContextKey,
  LaunchStatesContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  CloseInstanceContextKey,
  CSSThemeExtensions,
  ContextMenu,
  AccountActions,
  DefaultGlobalStatesPagesStates,
  SettingsSections,
  InstanceCreationSections,
  ContextMenuItems,
  HookResponseStatus,
  ExtraHookResponseStatus,
  LogKindColors,
  LogLevelColors,
} as const;
