import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";

export function getMinecraftDirectory({
  baseDirectory,
  instanceId,
}: {
  "baseDirectory": string;
  "instanceId"   : string;
}): string {
  return FileManager.join(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
    FileStructure.Folders.Instances.Folders._Entry_.Folders.Minecraft.Path,
  );
}
