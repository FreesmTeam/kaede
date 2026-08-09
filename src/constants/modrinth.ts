import { Patches } from "@/constants/meta.ts";
import FabricIcon from "@/resources/FabricIcon.webp";
import ForgeIcon from "@/resources/ForgeIcon.webp";
import NeoForgeIcon from "@/resources/NeoForgeIcon.webp";
import QuiltIcon from "@/resources/QuiltIcon.webp";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export const ModrinthAPI = {
  "Base"     : "https://api.modrinth.com/v2/",
  "Endpoints": {
    "Search" : "https://api.modrinth.com/v2/search",
    "Project": "https://api.modrinth.com/v2/project",
  },
  "ProjectType": "modpack",
  "SortIndex"  : "relevance",
  "PageSize"   : 30,
} as const;

export const ModrinthLoaders: Array<{
  "id"  : string;
  "name": string;
  "uid" : ExtendedPatchUIDType;
  "icon": string;
}> = [
  { "id": "fabric", "name": "Fabric", "uid": Patches.FabricLoader, "icon": FabricIcon },
  { "id": "forge", "name": "Forge", "uid": Patches.MinecraftForge, "icon": ForgeIcon },
  { "id": "neoforge", "name": "NeoForge", "uid": Patches.NeoForged, "icon": NeoForgeIcon },
  { "id": "quilt", "name": "Quilt", "uid": Patches.Quilt, "icon": QuiltIcon },
];

// https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack
export const MrpackDependencies: Record<string, ExtendedPatchUIDType> = {
  "minecraft"    : Patches.Minecraft,
  "fabric-loader": Patches.FabricLoader,
  "forge"        : Patches.MinecraftForge,
  "neoforge"     : Patches.NeoForged,
  "quilt-loader" : Patches.Quilt,
};

export default {
  ModrinthAPI,
  ModrinthLoaders,
  MrpackDependencies,
} as const;
