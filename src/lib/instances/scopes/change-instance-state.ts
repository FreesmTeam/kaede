import { nextTick } from "vue";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

/**
 * Changes a specified field in the instance states with the provided value
 * while handling all attached hooks.
 *
 * @param key   - A one-level deep key of an instance states object,
 *                i.e. an instance id.
 * @param value - A value that is stored in a field with the provided key.
 */
export function changeInstanceState<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
): void {
  const instanceStates = GlobalInternals.getInstanceStates();
  const hooksResult: "continue" | InstanceStatesType[Key] | undefined =
    ExtensionsManager.catchSyncResponseHooks<InstanceStatesType[Key]>({
      "scope" : "onInstanceChange",
      "toPass": value,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    instanceStates[key] = value;

    return;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    `Changing instance state. Key: ${key}; value`,
    value,
  ));
  instanceStates[key] = value;

  void (async (): Promise<void> => {
    await nextTick();
    await ExtensionsManager.catchAsyncVoidHooks({
      "scope" : "onInstanceChange",
      "toPass": value,
      "timing": "after",
    });

    ExtensionsManager.onInstanceStateChange(key, value);
  })();
}
