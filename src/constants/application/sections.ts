import ATLauncherIcon from "@/resources/ATLauncherIcon.svg";
import CraftingTableIcon from "@/resources/CraftingTableIcon.webp";
import CurseForgeIcon from "@/resources/CurseForgeIcon.webp";
import FTBIcon from "@/resources/FTBIcon.svg";
import ModrinthIcon from "@/resources/ModrinthIcon.webp";
import type { TabSectionType } from "@/types/application/tab-section.type.ts";

export const SettingsSections: Array<TabSectionType> = [
  {
    "id"  : "general",
    "name": "General",
    "icon": "i-lucide-sliders-horizontal",
  },
  {
    "id"  : "user-interface",
    "name": "User Interface",
    "icon": "i-lucide-paintbrush-vertical",
  },
  {
    "id"  : "minecraft",
    "name": "Minecraft",
    "icon": "i-lucide-box",
  },
  {
    "id"  : "java",
    "name": "Java",
    "icon": "i-lucide-coffee",
  },
  {
    "id"  : "extensions",
    "name": "Extensions",
    "icon": "i-lucide-blocks",
  },
  {
    "id"  : "plugin-playground",
    "name": "Plugin Playground",
    "icon": "i-lucide-square-terminal",
  },
];

export const InstanceCreationSections: Array<TabSectionType> = [
  {
    "id"   : "clean-minecraft",
    "name" : "Clean",
    "image": CraftingTableIcon,
  },
  {
    "id"   : "modrinth",
    "name" : "Modrinth",
    "image": ModrinthIcon,
  },
  {
    "id"   : "ftb-legacy",
    "name" : "FTB Legacy",
    "image": FTBIcon,
  },
  {
    "id"   : "curseforge",
    "name" : "CurseForge",
    "image": CurseForgeIcon,
  },
  {
    "id"   : "atlauncher",
    "name" : "ATLauncher",
    "image": ATLauncherIcon,
  },
];
