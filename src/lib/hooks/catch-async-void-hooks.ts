import type { KaedeNamespaceType } from "@/declarations.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export async function catchAsyncVoidHooks({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof KaedeNamespaceType["hooks"];
  "toPass": unknown;
  "timing": "before" | "after";
}): Promise<void> {
  const timeMeasurementStartAfter = performance.now();
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

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.execution(
      scope,
      timing,
      index,
      "async",
    ));
    try {
      await hook(toPass);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Caught an error while executing hook for '${scope}.${timing}':`,
        Errors.prettify(error),
      );

      continue;
    }

    const timeMeasurementEndHook = performance.now();
    const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate["no-response"](
      scope,
      timing,
      index,
      currentAfterHookTime,
      "async",
    ));
  }

  const timeMeasurementEndAfter = performance.now();
  const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.end(
    scope,
    timing,
    afterHooksTime,
  ));
}
