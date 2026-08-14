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

import { ActionKeys } from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Auth from "@/lib/auth";
import Configs from "@/lib/configs";
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
}
