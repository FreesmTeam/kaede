import { arch, platform, version } from "@tauri-apps/plugin-os";

import { ApplicationName } from "@/constants/application.ts";

const date = (new Date).toISOString();

export function getASCIIArt(
  portable: boolean,
  launchCount: number,
  launcherVersion: string,
  executableHash: string,
): string {
  const launchStatus: string = window.__TAURI__ === undefined ? (
    "browser"
  ) : (
    launchCount === 0
      ? "clean"
      : `reloaded ${launchCount} times`
  );

  return (
    "\n" +
    "\n    __                  __   " +
    "  me@" + ApplicationName.toLowerCase() + "_" + launcherVersion +
    "\n   / /______ ____  ____/ /__ " +
    "  os     " + platform() + " " + version() + " (" + arch() + ")" +
    "\n  / //_/ __ `/ _ \\/ __  / _ \\" +
    "  mode   " + (portable ? "portable" : "non-portable") +
    "\n / ,< / /_/ /  __/ /_/ /  __/" +
    "  date   " + date +
    "\n/_/|_|\\__,_/\\___/\\__,_/\\___/ " +
    "  launch " + launchStatus +
    "\n                             " + "  sha256 " + (executableHash || "unavailable") +
    "\n"
  );
}

export default {
  getASCIIArt,
} as const;