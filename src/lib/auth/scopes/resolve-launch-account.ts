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

import { confirm } from "@tauri-apps/plugin-dialog";

import { buildLaunchAuth } from "@/lib/auth/scopes/build-launch-auth.ts";
import { ensureFreshAccount } from "@/lib/auth/scopes/ensure-fresh-account.ts";
import Configs from "@/lib/configs";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

/**
 * Returning undefined means no instance will be launched
 *
 * @param accounts - an array of accounts to resolve the account from
 */
export async function resolveLaunchAccount(
  accounts: Array<AccountType>,
): Promise<{
  "auth"    : LaunchAuthType;
  "accounts": Array<AccountType>;
} | undefined> {
  const selectedIndex: number = globalStates.selected.account;
  const activeAccount: AccountType | undefined = accounts[selectedIndex];

  if (!activeAccount) {
    log.info(
      __PRE_BUNDLED_FILENAME__,
      "No accounts are present",
    );

    return undefined;
  }

  const { account, status } = await ensureFreshAccount(activeAccount);

  if (status === "failed") {
    const toContinue: boolean = await confirm(
      "An error happened while refreshing a token for the selected account." +
      "\n" +
      "Do you want to continue launching Minecraft? You won't be able to play on premium servers.",
      "Account refreshing",
    );

    if (!toContinue) {
      return undefined;
    }
  }

  if (status !== "refreshed") {
    return {
      "auth": buildLaunchAuth(account),
      accounts,
    };
  }

  const updatedAccounts: Array<AccountType> = [
    account,
    ...accounts.slice(1),
  ];

  await Configs.writeAccounts({ "accounts": updatedAccounts });

  return {
    "auth"    : buildLaunchAuth(account),
    "accounts": updatedAccounts,
  };
}
