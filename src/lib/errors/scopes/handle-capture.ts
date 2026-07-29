import { extract } from "@/lib/errors/scopes/extract.ts";
import { log } from "@/lib/logging/log.ts";
import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";

export function handleCapture(error: Error): NativeErrorType {
  const extractedError = extract(error);

  log.error(
    __PRE_BUNDLED_FILENAME__,
    "A global error was captured:",
    extractedError.name + ":",
    extractedError.message + ";",
    "Stack:",
    "\n" + extractedError.stack,
  );

  return extractedError;
}
