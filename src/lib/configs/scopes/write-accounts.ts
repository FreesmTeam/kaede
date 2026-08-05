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

import { writeTextFile } from "@tauri-apps/plugin-fs";

import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Schemas from "@/lib/schemas";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function writeAccounts({
  accounts,
  baseDirectory,
}: {
  "accounts"      : Array<AccountType>;
  "baseDirectory"?: string;
}): Promise<boolean> {
  const accountsPath: string = FileManager.join(
    baseDirectory ?? FileManager.getBaseDirectory(),
    FileStructure.Files.Accounts,
  );

  for (const [index, entry] of accounts.entries()) {
    const account: AccountType | false = Schemas.validate.account({
      "value": entry,
      "label": "account data (before writing)",
      "info" : {
        "id"   : entry?.profile?.name,
        "index": index,
      },
    });

    if (account === false) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        "Refusing to write the accounts file since an entry is not valid",
      );

      return false;
    }
  }

  try {
    await writeTextFile(
      accountsPath,
      JSON.stringify(accounts, null, 2),
    );
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to write the accounts file:",
      Errors.prettify(error),
    );

    return false;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Successfully wrote the accounts file");

  return true;
}
