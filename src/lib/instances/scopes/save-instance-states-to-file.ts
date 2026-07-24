import FileStructure from "@/constants/file-structure.ts";
import { Host } from "@/lib/capability-broker";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export async function saveInstanceStatesToFile(instances: InstanceStatesType): Promise<void> {
  log.debug(__PRE_BUNDLED_FILENAME__, "Starting the instance metadata sync");
  const timeStart = performance.now();
  const metadataPath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Files.Metadata,
  );

  await Host.files.writeText(metadataPath, JSON.stringify(
    instances,
    null,
    2,
  ));

  const timeEnd = performance.now();
  const timeDifference = (timeEnd - timeStart).toFixed(1);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "Instance metadata file successfully synced in:",
    timeDifference,
    "ms",
  );
}
