import { getMain } from "@/lib/configs/get-main.ts";
import { getAccounts } from "@/lib/configs/scopes/get-accounts.ts";
import { getCachedInitial } from "@/lib/configs/scopes/get-cached-initial.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { getSafeConfigFile } from "@/lib/configs/scopes/get-safe-config-file.ts";
import { getTranslations } from "@/lib/configs/scopes/get-translations.ts";
import { initializeConfigFile } from "@/lib/configs/scopes/initialize-config-file.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";
import { sync } from "@/lib/configs/sync.ts";

export default {
  getMain,
  sync,

  "get"       : getMain,
  "getDefault": getDefaultConfig,
  "getSafe"   : getSafeConfigFile,
  "initialize": initializeConfigFile,
  "regenerate": regenerateConfigFile,
  getAccounts,
  getCachedInitial,
  getTranslations,
} as const;
