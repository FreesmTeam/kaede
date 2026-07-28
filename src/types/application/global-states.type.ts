import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export type GlobalStatesPagesType = {
  "current": RouteType;
  "states" : {
    "home": Partial<{
      // TODO: something
      "stats": unknown;
    }>;
    "library": Partial<{
      // TODO: instance list groups
      "group": unknown;
    }>;
    "settings": Partial<{
      "tab": string;
    }>;
    "add-instance": Partial<{
      "instanceVersionSearch": {
        "patch": ExtendedPatchUIDType;
        "input": string;
      };
      "instance": {
        "name"         : string;
        "entry"        : ExtendedPatchUIDType;
        "checksum"     : boolean;
        "groups"       : Array<string>;
        "javaBinary"   : string;
        "patchVersions": InstanceStateType["patchVersions"];
        "windowHeight" : number;
        "windowWidth"  : number;
        "icon"        ?: string;
        "add"          : {
          "jvmArguments" : Array<string>;
          "gameArguments": Array<string>;
        };
      };
      "full"          : boolean;
      "tab"           : string;
      "customSettings": Array<{
        "label"?: string;
        "input"?: {
          "onInput": (
            value: string,
            currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
            currentPatch: ExtendedPatchUIDType,
          ) => void;
          "iconClassName": string;
          "placeholder"  : string;
          "defaultValue"?: () => string | undefined;
          "tooltip"     ?: string;
          "type"        ?: "text" | "number";
          "debounceTime"?: number;
        };
      }>;
    }>;
    // Reserved for extensions' needs
    "none": Record<string, unknown>;
  };
};
export type GlobalStatesSidebarItemsType = Array<"divider" | {
  "path"  : RouteType;
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
export type GlobalStatesContextMenuItemsType = Array<{
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
// Global minecraft settings
export type GlobalStatesMinecraftType = {
  "windowHeight": number;
  "windowWidth" : number;
  "icon"        : string;
  "javaBinary"  : string;
  "add"         : Partial<{
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  }>;
  "remove": Partial<{
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  }>;
};
type DevelopmentType = {
  "loadErudaDevTools"         : boolean;
  "showFPS"                   : boolean;
  "showCPUUsage"              : boolean;
  "showMemoryUsage"           : boolean;
  "enableDebugMode"           : boolean;
  "enableNativeContextMenu"   : boolean;
  "enableNativeReloadKeyBinds": boolean;
};
type ExtensionsType = {
  "list"                      : Array<{ "enabled": boolean; "id": string }>;
  "enabled"                   : boolean;
  "allowUnrestrictedUntrusted": boolean;
  "showAppAfterExtensionsLoad": boolean;
};
type UIType = {
  "ripple": {
    "color"   : string | null;
    "sparkles": string | null;
  };
  "background": {
    "image"  : string | null;
    "blur"   : number | null;
    "color"  : string | null;
    "isVideo": boolean | null;
    "key"    : string | number | null;
  };
  "text": {
    "font"          : string | null;
    "mainColor"     : string | null;
    "secondaryColor": string | null;
  };
  "widget": {
    "blur"          : number | null;
    "textColor"     : string | null;
    "secondaryColor": string | null;
    "background"    : string | null;
  };
  "atAGlance": {
    "title"   : string | null;
    "subtitle": string | null;
  };
};
type SelectedType = {
  "locale"         : string;
  "currentInstance": string | null;
  "stats"          : "playtime" | "last-launch";
};
type LogsType = {
  "show"       : boolean;
  "virtualized": boolean;
  "mode"       : "kaede-launcher" | string;
  "filtering"  : string;
  "lineHeight" : number;
  "partsShown" : Record<"time" | "level" | "target" | "message", boolean>;
  "partsSize"  : Record<"time" | "level" | "target" | "message", number>;
};

export type GlobalStatesType = {
  // Specified in config (only JSON values)
  "development"     : DevelopmentType;
  "extensions"      : ExtensionsType;
  "ui"              : UIType;
  "selected"        : SelectedType;
  "logs"            : LogsType;

  "minecraft"       : GlobalStatesMinecraftType;
  // Not specified in config (non-JSON values)
  "translations"    : TranslationsType;
  "sidebarItems"    : GlobalStatesSidebarItemsType;
  "contextMenuItems": GlobalStatesContextMenuItemsType;
  "pages"           : GlobalStatesPagesType;
};
