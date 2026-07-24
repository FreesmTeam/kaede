import { ApplicationName } from "@/constants/application.ts";
import { Host } from "@/lib/capability-broker";

const date = (new Date).toISOString();

export function getASCIIArt(portable: boolean, launchCount: number): string {
  const snapshot = Host.runtime.getCachedSnapshot();
  const launchStatus: string = snapshot.kind === "browser-preview" ? (
    "browser"
  ) : (
    launchCount === 0
      ? "clean"
      : `reloaded ${launchCount} times`
  );

  return (
    "\n" +
    "\n    __                  __   " +
    "  me@" + ApplicationName.toLowerCase() +
    "\n   / /______ ____  ____/ /__ " +
    "  os     " + snapshot.os.platform + " " + snapshot.os.version +
    "\n  / //_/ __ `/ _ \\/ __  / _ \\" +
    "  arch   " + snapshot.os.arch +
    "\n / ,< / /_/ /  __/ /_/ /  __/" +
    "  mode   " + (portable ? "portable" : "non-portable") +
    "\n/_/|_|\\__,_/\\___/\\__,_/\\___/ " +
    "  date   " + date +
    "\n                             " + "  launch " + launchStatus +
    "\n"
  );
}

export default {
  getASCIIArt,
} as const;
