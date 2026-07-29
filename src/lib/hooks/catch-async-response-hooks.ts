import { ExtraHookResponseStatus, HookResponseStatus } from "@/constants/application.ts";
import type { KaedeNamespaceType } from "@/declarations.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import { handleHookResponse } from "@/lib/hooks/handle-hook-response.ts";
import { log } from "@/lib/logging/log.ts";
import type { ExtensionStatusType, HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export async function catchAsyncResponseHooks<T>({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof KaedeNamespaceType["hooks"];
  "toPass": unknown;
  "timing": "before" | "after";
}): Promise<"continue" | T | undefined> {
  const timeMeasurementStartBefore = performance.now();
  const currentScopeHooks = GlobalObject.hooks[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks = currentScopeHooks[timing] as HookReturnType<unknown, unknown>;

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.start(
    scope,
    timing,
    hooks.length,
  ));
  for (const [index, hook] of hooks.entries()) {
    const timeMeasurementStartHook = performance.now();
    let status: ExtensionStatusType;
    let response: T | undefined;

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.execution(
      scope,
      timing,
      index,
      "async",
    ));
    try {
      const data = await hook(toPass) as {
        "status"  : ExtensionStatusType;
        "response": T | undefined;
      };

      status = data.status;
      response = data.response;
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Caught an error while executing hook for '${scope}.${timing}':`,
        Errors.prettify(error),
      );

      continue;
    }

    const handledResponse = handleHookResponse({
      scope,
      status,
      response,
      timing,
      index,
      "times": {
        "overallStart": timeMeasurementStartBefore,
        "hookStart"   : timeMeasurementStartHook,
      },
    });

    if (handledResponse === ExtraHookResponseStatus.ContinueLoop) {
      continue;
    }

    return handledResponse;
  }

  return HookResponseStatus.Continue;
}
