import { addInstanceWithSync } from "@/lib/instances/scopes/add-instance-with-sync.ts";
import { changeInstanceState } from "@/lib/instances/scopes/change-instance-state.ts";
import { createInstance } from "@/lib/instances/scopes/create-instance.ts";
import { extractSavedFromPages } from "@/lib/instances/scopes/extract-saved-from-pages.ts";
import { findCurrent } from "@/lib/instances/scopes/find-current.ts";
import { getConfigInstanceStates } from "@/lib/instances/scopes/get-config-instance-states.ts";
import { getMinecraftDirectory } from "@/lib/instances/scopes/get-minecraft-directory.ts";
import { readStoredInstances } from "@/lib/instances/scopes/read-stored-instances.ts";
import { saveInstanceStatesToFile } from "@/lib/instances/scopes/save-instance-states-to-file.ts";
import { getInstanceStates } from "@/states/instance.ts";

export default {
  "get"          : getInstanceStates,
  "change"       : changeInstanceState,
  "add"          : addInstanceWithSync,
  "create"       : createInstance,
  "getFromConfig": getConfigInstanceStates,
  "readStored"   : readStoredInstances,
  "syncMetadata" : saveInstanceStatesToFile,
  extractSavedFromPages,
  getMinecraftDirectory,
  findCurrent,
} as const;
