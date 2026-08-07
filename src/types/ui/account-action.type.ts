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

import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";

export type AccountActionHandlersType = {
  "reset"  : () => void;
  "pending": () => void;
  "success": () => void;
  "error"  : (message: string, error?: unknown) => void;
};
export type AccountActionType = {
  "icon"  : string;
  "label" : string;
  "action": (properties: {
    "event"   : MouseEvent;
    "account" : AccountType;
    // We are passing this so that the action can easily make changes to 'accounts.json'
    "accounts": WrappedAccountsType | undefined;
    // These reflect statuses in the UI
    "handlers": AccountActionHandlersType;
  }) => void | Promise<void>;
  "disabled"?: (account: AccountType) => boolean;
};
export type AccountActionCollectionType = Array<AccountActionType>;
