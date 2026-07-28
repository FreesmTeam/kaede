import type { KaedeNamespaceType } from "@/declarations.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export function catchSyncVoidHooks({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof KaedeNamespaceType["hooks"];
  "toPass": unknown;
  "timing": "before" | "after";
}): void {
  const timeMeasurementStartAfter = performance.now();
  const currentScopeHooks = GlobalObject.hooks[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks = currentScopeHooks[timing] as HookReturnType<unknown, "nothing", "non-promise">;

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
      "sync",
    ));
    hook(toPass);

    const timeMeasurementEndHook = performance.now();
    const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate["no-response"](
      scope,
      timing,
      index,
      currentAfterHookTime,
      "sync",
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
