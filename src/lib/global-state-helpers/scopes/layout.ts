import { GlobalObject } from "@/extendable/global-object.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

function toggle(state?: ConfigType["layout"]["custom"]): void {
  const layout = GlobalObject.libs.GlobalStateHelpers.get().layout;

  if (state === undefined && typeof layout.custom !== "boolean") {
    return;
  }

  GlobalObject.libs.GlobalStateHelpers.change("layout", {
    ...layout,
    // Now either 'state' exists or 'layout.custom' is boolean
    "custom": state ?? !layout.custom,
  });
}
function overrideProperties(
  key: "background" | "sidebar",
  input: Partial<GlobalStatesType["layout"]["background" | "sidebar"]>,
): void {
  const layout = GlobalObject.libs.GlobalStateHelpers.get().layout;

  GlobalObject.libs.GlobalStateHelpers.change("layout", {
    ...layout,
    [key]: {
      ...layout[key],
      ...input,
    },
  });
}

export const Layout = {
  toggle,
  "overrideBackground": (input: Partial<GlobalStatesType["layout"]["background"]>): void => {
    overrideProperties("background", input);
  },
  "overrideSidebar": (input: Partial<GlobalStatesType["layout"]["sidebar"]>): void => {
    overrideProperties("sidebar", input);
  },
};
