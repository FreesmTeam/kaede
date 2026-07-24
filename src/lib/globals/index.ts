import { cacheLauncherVersion } from "@/lib/globals/scopes/cache-launcher-version.ts";
import { cachePathJoin } from "@/lib/globals/scopes/cache-path-join.ts";
import {
  declareGlobals,
  revokeExtensionGlobals,
} from "@/lib/globals/scopes/declare-globals.ts";
import { getLaunchCount } from "@/lib/globals/scopes/get-launch-count.ts";
import { registerComponent } from "@/lib/globals/scopes/register-component.ts";

export default {
  cacheLauncherVersion,
  cachePathJoin,
  declareGlobals,
  getLaunchCount,
  registerComponent,
  revokeExtensionGlobals,
} as const;
