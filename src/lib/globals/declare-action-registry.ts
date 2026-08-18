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

import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";

import { ActionKeys, ContextMenu } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Auth from "@/lib/auth";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import Initialization from "@/lib/initialization";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { EnsureFreshResultType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountActionPropertiesType } from "@/types/ui/account-action.type.ts";

export function declareActionRegistry(): void {
  ActionRegistry.register(
    ActionKeys.AccountsRefresh,
    async ({ account, accounts, handlers }: AccountActionPropertiesType) => {
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
  );
  ActionRegistry.register(
    ActionKeys.AccountsCopyUUID,
    async ({ account, handlers }: AccountActionPropertiesType) => {
      await writeText(account.profile.uuid);

      handlers.success();
    },
  );
  ActionRegistry.register(
    ActionKeys.AccountsRemove,
    async ({ account, accounts, handlers }: AccountActionPropertiesType) => {
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
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuSoftReload,
    (): void => window.location.reload(),
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuHardReload,
    Initialization.recreateWebView,
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuProcessReload,
    relaunch,
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuLogs,
    (): void => {
      globalStates.logs.show = true;

      ContextMenu.close();
    },
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuRootFolder,
    (): void => {
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
  );
  ActionRegistry.register(
    ActionKeys.ContextMenuInstanceFolder,
    (): void => {
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
  );
  ActionRegistry.register(
    ActionKeys.SidebarRouteChange,
    ({ item }: {
      "item" : GlobalStatesType["sidebarItems"][number];
      "event": PointerEvent;
    }): void => {
      if (item === "divider") {
        return;
      }

      Router.navigate(item.path);
    },
  );
}
