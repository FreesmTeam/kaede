import { appDataDir } from "@tauri-apps/api/path";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import General from "@/lib/general";

export function getBaseDirectory(portable?: boolean): Promise<string> {
  return (portable ?? GlobalInternals.portable)
    ? General.getExecutableDirectory()
    : appDataDir();
}