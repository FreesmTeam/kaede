import { GrantedScopes } from "@/constants/permissions.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export function handleLoggingPermission(id: string): void {
  const wrappedLog = (
    method: "debug" | "info" | "warn" | "error",
    ...input: Array<string>
  ): void => {
    if (method === "error") console.error(...input);
    if (method === "info") console.info(...input);
    if (method === "warn") console.warn(...input);
    if (method === "debug") console.debug(...input);

    return log[method](`${id}`, ...input);
  };

  GrantedScopes[id].log = {
    "debug": (...input: Array<string>): void => wrappedLog("debug", ...input),
    "info" : (...input: Array<string>): void => wrappedLog("info", ...input),
    "warn" : (...input: Array<string>): void => wrappedLog("warn", ...input),
    "error": (...input: Array<string>): void => wrappedLog("error", ...input),
  };
}
