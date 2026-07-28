import {
  joinBrowserPath,
  normalizeBrowserPath,
} from "@/lib/browser/scopes/browser-preview-paths.ts";
import type {
  DirectHostFacade,
  RuntimeSnapshot,
} from "@/lib/capability-broker/types.ts";

export const BROWSER_RUNTIME_SNAPSHOT: RuntimeSnapshot = Object.freeze({
  "kind"               : "browser-preview",
  "launchCount"        : 1,
  "portable"           : false,
  "baseDirectory"      : "indexed_db",
  "executableDirectory": "indexed_db",
  "appDataDirectory"   : "indexed_db",
  "os"                 : Object.freeze({
    "platform": "linux",
    "arch"    : "x86_64",
    "version" : "unknown",
  }),
});

export function createBrowserDirectHostFacade(): DirectHostFacade {
  return Object.freeze({
    "app": Object.freeze({
      "name"        : async (): Promise<string> => "Kaede",
      "version"     : async (): Promise<string> => "0.0.0",
      "tauriVersion": async (): Promise<string> => "browser-preview",
    }),
    "path": Object.freeze({
      "join"     : async (...parts): Promise<string> => joinBrowserPath(...parts),
      "normalize": async (path): Promise<string> => normalizeBrowserPath(path),
    }),
    "showMainWebview": async (): Promise<void> => {},
  } satisfies DirectHostFacade);
}
