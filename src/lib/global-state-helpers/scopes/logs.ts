import { GlobalObject } from "@/extendable/global-object.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

function toggle<Key extends keyof GlobalStatesType["logs"]>(
  key: Key,
  isEnabled?: boolean,
): void {
  const logs = GlobalObject.libs.GlobalStateHelpers.get().logs;
  const currentValue = logs[key];

  if (typeof currentValue !== "boolean") {
    return;
  }

  const newLogs = {
    ...logs,
    [key]: isEnabled ?? !currentValue,
  };

  GlobalObject.libs.GlobalStateHelpers.change("logs", newLogs);
}
function filterBy(newValue: string): void {
  const logs = GlobalObject.libs.GlobalStateHelpers.get().logs;

  GlobalObject.libs.GlobalStateHelpers.change("logs", {
    ...logs,
    "filtering": newValue,
  });
}
function selectMode(newValue: string): void {
  const logs = GlobalObject.libs.GlobalStateHelpers.get().logs;

  GlobalObject.libs.GlobalStateHelpers.change("logs", {
    ...logs,
    "mode": newValue,
  });
}

export const Logs = {
  toggle,
  filterBy,
  selectMode,
};
