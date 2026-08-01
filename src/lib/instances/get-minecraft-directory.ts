import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";

export function getMinecraftDirectory({
  baseDirectory,
  instanceId,
}: {
  "baseDirectory": string;
  "instanceId"   : string;
}): {
  "instanceDirectory"    : string;
  "instanceRootDirectory": string;
} {
  const instanceRootDirectory: string = FileManager.join(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
  );
  const instanceDirectory: string = FileManager.join(
    instanceRootDirectory,
    FileStructure.Folders.Instances.Folders._Entry_.Folders.Minecraft.Path,
  );

  return { instanceDirectory, instanceRootDirectory };
}
