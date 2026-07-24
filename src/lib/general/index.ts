import { nextTick } from "vue";

import { cachedJoin } from "@/lib/general/scopes/cached-join.ts";
import { capitalize } from "@/lib/general/scopes/capitalize.ts";
import { checkDaysDifference } from "@/lib/general/scopes/check-days-difference.ts";
import { concurrentlyDownload } from "@/lib/general/scopes/concurrently-download.ts";
import { finalizeInitialization } from "@/lib/general/scopes/finalize-initialization.ts";
import { gcd } from "@/lib/general/scopes/gcd.ts";
import { getAtAGlance } from "@/lib/general/scopes/get-at-a-glance.ts";
import { getBaseDirectory } from "@/lib/general/scopes/get-base-directory.ts";
import { getCachedBaseDirectory } from "@/lib/general/scopes/get-cached-base-directory.ts";
import { getCachedPortable } from "@/lib/general/scopes/get-cached-portable.ts";
import { getExecutableDirectory } from "@/lib/general/scopes/get-executable-directory.ts";
import { getInitialState } from "@/lib/general/scopes/get-initial-state.ts";
import { getJavaMajor } from "@/lib/general/scopes/get-java-major.ts";
import { getLauncherVersion } from "@/lib/general/scopes/get-launcher-version.ts";
import { getMissingPaths } from "@/lib/general/scopes/get-missing-paths.ts";
import { getRelativeDate } from "@/lib/general/scopes/get-relative-date.ts";
import { getSha1Mismatches } from "@/lib/general/scopes/get-sha1-mismatches.ts";
import { getSidebarInnerStyles } from "@/lib/general/scopes/get-sidebar-inner-styles.ts";
import { handleJsonFile } from "@/lib/general/scopes/handle-json-file.ts";
import { hashFileContents } from "@/lib/general/scopes/hash-file-contents.ts";
import { hashOfflineNickname } from "@/lib/general/scopes/hash-offline-nickname.ts";
import { hashString } from "@/lib/general/scopes/hash-string.ts";
import { hashStringCrypto } from "@/lib/general/scopes/hash-string-crypto.ts";
import { unzip } from "@/lib/general/scopes/unzip.ts";

export default {
  "nextTick": (): Promise<void> => {
    return nextTick();
  },
  cachedJoin,
  capitalize,
  checkDaysDifference,
  concurrentlyDownload,
  finalizeInitialization,
  gcd,
  getAtAGlance,
  getBaseDirectory,
  getCachedBaseDirectory,
  getCachedPortable,
  getExecutableDirectory,
  getInitialState,
  getJavaMajor,
  getLauncherVersion,
  getMissingPaths,
  getSha1Mismatches,
  getRelativeDate,
  getSidebarInnerStyles,
  handleJsonFile,
  hashFileContents,
  hashOfflineNickname,
  hashString,
  hashStringCrypto,
  unzip,
} as const;
