import { ExtraHookResponseStatus, HookResponseStatus } from "@/constants/application.ts";
import type { KaedeNamespaceType } from "@/declarations.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

export function handleHookResponse<T>({
  scope,
  status,
  response,
  timing,
  index,
  times,
}: {
  "scope"   : keyof KaedeNamespaceType["hooks"];
  "status"  : ExtensionStatusType;
  "response": T | undefined;
  "timing"  : "before" | "after";
  "index"   : number;
  "times"   : {
    "overallStart": number;
    "hookStart"   : number;
  };
}): "continue-hooks-loop" | T | undefined {
  const timeMeasurementEndHook = performance.now();
  const currentHookTime = timeMeasurementEndHook - times.hookStart;

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.response(
    scope,
    { status, response },
    timing,
    index,
    currentHookTime,
  ));

  if (status !== HookResponseStatus.Stop) {
    return ExtraHookResponseStatus.ContinueLoop;
  }

  const timeMeasurementEnd = performance.now();
  const hooksTime = timeMeasurementEnd - times.overallStart;

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.end(
    scope,
    timing,
    hooksTime,
  ));

  return response;
}
