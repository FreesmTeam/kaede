import Launcher from "@/lib/launcher";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import {
  createHandleLaunch,
} from "@/lib/launcher/scopes/handle-launch-core.ts";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import Validators from "@/lib/launcher/scopes/validators";

export const handleLaunch = createHandleLaunch({
  "getLauncher": (): typeof Launcher => Launcher,
  Extractors,
  Fetching,
  Parsers,
  Patches,
  Validators,
});
