import type { Component } from "vue";

import { ActionRegistry, Actions } from "@/extendable/action-registry.ts";
import { __registerComponent, __restoreComponent, C } from "@/extendable/component-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { declareActionRegistry } from "@/lib/globals/declare-action-registry.ts";
import { declareGlobals } from "@/lib/globals/declare-globals.ts";

export default {
  declareActionRegistry,
  declareGlobals,
  Actions,
  ActionRegistry,
  "Components"       : C,
  "registerAction"   : ActionRegistry.register,
  "getAction"        : ActionRegistry.get,
  "executeAction"    : ActionRegistry.execute,
  "getAllActions"    : ActionRegistry.getAll,
  "registerComponent": __registerComponent,
  "restoreComponent" : __restoreComponent,
  "getComponent"     : (id: string): Component | undefined => (
    GlobalInternals.appInstance?.component?.(id)
  ),
} as const;
