import { create } from "@/lib/instances/create.ts";
import { extractSavedFromPages } from "@/lib/instances/extract-saved-from-pages.ts";
import { findCurrent } from "@/lib/instances/find-current.ts";
import { getMinecraftDirectory } from "@/lib/instances/get-minecraft-directory.ts";
import { readInstances } from "@/lib/instances/read-instances.ts";
import { sync } from "@/lib/instances/sync.ts";

export default {
  create,
  extractSavedFromPages,
  findCurrent,
  getMinecraftDirectory,
  readInstances,
  sync,
} as const;
