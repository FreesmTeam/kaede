import { Type } from "typebox";

const LaunchArgumentsSchema = Type.Object({
  "jvmArguments" : Type.Array(Type.String()),
  "gameArguments": Type.Array(Type.String()),
});
const OptionalLaunchArgumentsSchema = Type.Partial(LaunchArgumentsSchema);

export const MinecraftSchema = Type.Object({
  "windowHeight": Type.Number(),
  "windowWidth" : Type.Number(),
  "icon"        : Type.String(),
  "javaBinary"  : Type.String(),
  "add"         : OptionalLaunchArgumentsSchema,
  "remove"      : OptionalLaunchArgumentsSchema,
});
