import { fetchJavaMajor } from "@/lib/launcher/fetching/fetch-java-major.ts";
import Arguments from "@/lib/launcher/scopes/arguments";
import { createCommand } from "@/lib/launcher/scopes/create-command.ts";
import Extractors from "@/lib/launcher/scopes/extractors";
import Fetching from "@/lib/launcher/scopes/fetching";
import { handleLaunch } from "@/lib/launcher/scopes/handle-launch.ts";
import Parsers from "@/lib/launcher/scopes/parsers";
import Patches from "@/lib/launcher/scopes/patches";
import { spawnMinecraft } from "@/lib/launcher/scopes/spawn-minecraft.ts";
import Validators from "@/lib/launcher/scopes/validators";

export default {
  "__unused": {

    /*
     * // useApplet,
     * useShell,
     */
  },
  fetchJavaMajor,
  Arguments,
  Extractors,
  Fetching,
  Parsers,
  Patches,
  Validators,
  createCommand,
  handleLaunch,
  spawnMinecraft,
} as const;
