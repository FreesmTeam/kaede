import { nextTick } from "vue";

import { HookMappings } from "@/constants/hooks.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

/**
 * Changes a specified field in the global states with the provided value
 * while handling all attached hooks.
 *
 * @param key   - A one-level deep key of a global states object,
 *                e.g. 'development', 'extensions', or 'layout'.
 * @param value - A value that is stored in a field with the provided key.
 */
export function changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  const globalStates = GlobalInternals.getGlobalStates();
  const mappedKey = HookMappings[key];
  const hooksResult: "continue" | GlobalStatesType[Key] | undefined =
    ExtensionsManager.catchSyncResponseHooks<GlobalStatesType[Key]>({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    globalStates[key] = value;

    return;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    `Changing the global state. Key: ${key}; value`,
    value,
  ));
  globalStates[key] = value;

  void (async (): Promise<void> => {
    await nextTick();
    await ExtensionsManager.catchAsyncVoidHooks({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "after",
    });

    ExtensionsManager.onGlobalStateChange(key, value);
  })();
}
