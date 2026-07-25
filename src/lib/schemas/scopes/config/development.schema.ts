import { Type } from "typebox";

export const DevelopmentSchema = Type.Object({
  "loadErudaDevTools"         : Type.Boolean(),
  "showFPS"                   : Type.Boolean(),
  "showCPUUsage"              : Type.Boolean(),
  "showMemoryUsage"           : Type.Boolean(),
  "enableDebugMode"           : Type.Boolean(),
  "enableNativeContextMenu"   : Type.Boolean(),
  "enableNativeReloadKeyBinds": Type.Boolean(),
});
