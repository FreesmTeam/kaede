import { Type } from "typebox";

export const MinecraftSchema = Type.Object({
  "windowHeight": Type.Number(),
  "windowWidth" : Type.Number(),
  "icon"        : Type.String(),
  "javaBinary"  : Type.String(),
  "add"         : Type.Object({
    "jvmArguments" : Type.Array(Type.String()),
    "gameArguments": Type.Array(Type.String()),
  }),
  "remove": Type.Object({
    "jvmArguments" : Type.Array(Type.String()),
    "gameArguments": Type.Array(Type.String()),
  }),
});
