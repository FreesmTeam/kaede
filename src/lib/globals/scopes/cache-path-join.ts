import { GlobalInternals } from "@/extendable/global-internals.ts";
import { DirectHost } from "@/lib/capability-broker";
import { log } from "@/lib/logging/scopes/log.ts";

const Placeholder = "buh";

export async function cachePathJoin(): Promise<void> {
  // We don't care about promise rejection here, since we can't do much about error
  const joined = await DirectHost.path.join(Placeholder, Placeholder);
  // Extract the delimiter by removing 3 characters from both ends
  const delimiter = joined.slice(Placeholder.length, -Placeholder.length);

  log.debug(__PRE_BUNDLED_FILENAME__, "Current path delimiter:", delimiter);
  GlobalInternals.joinDelimiter = delimiter;
}
