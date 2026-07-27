import { cacheLauncherVersion } from "@/lib/globals/scopes/cache-launcher-version.ts";
import { cachePathJoin } from "@/lib/globals/scopes/cache-path-join.ts";
import {
  declareGlobalsWithApi,
  revokeExtensionGlobals,
} from "@/lib/globals/scopes/declare-globals-core.ts";
import { getLaunchCount } from "@/lib/globals/scopes/get-launch-count.ts";
import { registerComponent } from "@/lib/globals/scopes/register-component.ts";

function declareGlobals(): void {
  declareGlobalsWithApi(Globals);
}

const Globals = {
  cacheLauncherVersion,
  cachePathJoin,
  declareGlobals,
  getLaunchCount,
  registerComponent,
  revokeExtensionGlobals,
} as const;

export default Globals;
