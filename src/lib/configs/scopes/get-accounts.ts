import FileStructure from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/initial-state.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function getAccounts(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<Array<AccountType>> {
  const baseDirectory: string = properties?.baseDirectory ?? General.getCachedBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;

  const parsedAccounts: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Files.Accounts],
      "label"          : FileStructure.Files.Accounts,
      "getDefaultValue": async (): Promise<Array<unknown>> => ([]),
    });

  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the parsed accounts file");

  if (!Array.isArray(parsedAccounts)) {
    log.info(__PRE_BUNDLED_FILENAME__, "The provided accounts data is not array-like");

    return [];
  }

  const validAccounts: Array<AccountType> = [];

  for (const [index, entry] of parsedAccounts.entries()) {
    const account: AccountType | false = Schemas.validate.account({
      "value": entry,
      "label": "account data",
      "info" : {
        "id"   : entry?.profile?.name,
        "index": index,
      },
    });

    if (account !== false) {
      validAccounts.push(entry);
    }
  }

  return validAccounts;
}
