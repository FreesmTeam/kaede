import { log } from "@/lib/logging/log.ts";

export function handleLoggingPermission({ id }: { "id": string }): unknown {
  const wrappedLog = (
    method: "debug" | "info" | "warn" | "error",
    ...input: Array<string>
  ): void => {
    return log[method](`${id}`, ...input);
  };

  return harden({
    "debug": (...input: Array<string>): void => wrappedLog("debug", ...input),
    "info" : (...input: Array<string>): void => wrappedLog("info", ...input),
    "warn" : (...input: Array<string>): void => wrappedLog("warn", ...input),
    "error": (...input: Array<string>): void => wrappedLog("error", ...input),
  });
}
