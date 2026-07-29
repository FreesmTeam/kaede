import FileStructure from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";

export async function readStoredInstances(properties?: Partial<{
  "baseDirectory": string;
  "parsedFile"   : ParsedFile;
}>): Promise<InstanceStatesType> {
  const baseDirectory = properties?.baseDirectory ?? General.getCachedBaseDirectory();
  const parsedFile: ParsedFile | undefined = properties?.parsedFile;
  const parsedMetadata: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await General.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Files.Metadata],
      "label"          : FileStructure.Files.Metadata,
      "getDefaultValue": async (): Promise<object> => ({}),
    });

  log.debug(__PRE_BUNDLED_FILENAME__, "Validating the instances metadata");

  if (typeof parsedMetadata !== "object" || parsedMetadata === null) {
    log.debug(__PRE_BUNDLED_FILENAME__, "Instances metadata are completely invalid");

    return {};
  }

  const validInstances: InstanceStatesType = {};
  let allValid: boolean = true;

  for (const [currentId, currentMetadata] of Object.entries(parsedMetadata)) {
    const instance: InstanceStateType | false = Schemas.validate.instance({
      "value": currentMetadata,
      "label": "instance",
      "info" : {
        "id": currentId,
      },
    });

    if (instance === false) {
      allValid = false;

      continue;
    }

    validInstances[currentId] = currentMetadata;
  }

  if (allValid) {
    log.info(__PRE_BUNDLED_FILENAME__, "All specified metadata instances are valid");
  }

  return validInstances;
}
