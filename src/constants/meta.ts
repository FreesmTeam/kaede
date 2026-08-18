import type { ActionKeyType } from "@/constants/application.ts";
import FabricIcon from "@/resources/FabricIcon.webp";
import ForgeIcon from "@/resources/ForgeIcon.webp";
import LiteLoaderIcon from "@/resources/LiteLoaderIcon.webp";
import MinecraftIcon from "@/resources/MinecraftIcon.webp";
import NeoForgeIcon from "@/resources/NeoForgeIcon.webp";
import OptiFineIcon from "@/resources/OptiFineIcon.webp";
import QuiltIcon from "@/resources/QuiltIcon.webp";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export const Patches = {
  "AzulJava"          : "com.azul.java",
  "LiteLoader"        : "com.mumfrey.liteloader",
  "AdoptiumJava"      : "net.adoptium.java",
  "FabricLoader"      : "net.fabricmc.fabric-loader",
  "FabricIntermediary": "net.fabricmc.intermediary",
  "Minecraft"         : "net.minecraft",
  "MinecraftJava"     : "net.minecraft.java",
  "MinecraftForge"    : "net.minecraftforge",
  "NeoForged"         : "net.neoforged",
  "LWJGL"             : "org.lwjgl",
  "LWJGL3"            : "org.lwjgl3",
  "Quilt"             : "org.quiltmc.quilt-loader",
} as const;
export const PrettyPatchLabels = {
  "com.azul.java"               : "Azul JDK",
  "com.mumfrey.liteloader"      : "Lite Loader",
  "net.adoptium.java"           : "Temurin JDK",
  "net.fabricmc.fabric-loader"  : "Fabric MC",
  "net.fabricmc.intermediary"   : "Fabric MC (intermediary)",
  "net.minecraft"               : "Vanilla Minecraft",
  "net.minecraft.java"          : "Minecraft Java",
  "net.minecraftforge"          : "Forge",
  "net.neoforged"               : "NeoForge",
  "org.lwjgl"                   : "LWJGL",
  "org.lwjgl3"                  : "LWJGL3",
  "org.quiltmc.quilt-loader"    : "QuiltMC",
  "optifine.OptiFine"           : "OptiFine",
  "org.mcphackers.launchwrapper": "Vanilla Minecraft (custom launchwrapper)",
} as const;
export const PatchUIDs = Object.values(Patches);
export const CustomPatches = {
  "OptiFine"               : "optifine.OptiFine",
  "MCPHackersLaunchWrapper": "org.mcphackers.launchwrapper",
} as const;

// The order is the same as in HMCL
export const InstallablePatches: Array<{
  "id"     : string;
  "uid"    : ExtendedPatchUIDType;
  "name"   : string;
  "icon"  ?: string;
  "action"?: ActionKeyType;
}> = [
  { "id": "minecraft", "uid": Patches.Minecraft, "name": "Vanilla", "icon": MinecraftIcon },
  { "id": "forge", "uid": Patches.MinecraftForge, "name": "Forge", "icon": ForgeIcon },
  { "id": "neoforge", "uid": Patches.NeoForged, "name": "NeoForge", "icon": NeoForgeIcon },
  { "id": "optifine", "uid": CustomPatches.OptiFine, "name": "OptiFine", "icon": OptiFineIcon },
  { "id": "fabric", "uid": Patches.FabricLoader, "name": "Fabric", "icon": FabricIcon },
  { "id": "quilt", "uid": Patches.Quilt, "name": "Quilt", "icon": QuiltIcon },
  { "id": "liteloader", "uid": Patches.LiteLoader, "name": "LiteLoader", "icon": LiteLoaderIcon },
];

export default {
  Patches,
  PrettyPatchLabels,
  PatchUIDs,
  CustomPatches,
  InstallablePatches,
} as const;
