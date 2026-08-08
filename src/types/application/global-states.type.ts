import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { SignInStatusType } from "@/types/auth/microsoft-auth.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

type DevelopmentType = {
  "loadErudaDevTools"         : boolean;
  "showFPS"                   : boolean;
  "showCPUUsage"              : boolean;
  "showMemoryUsage"           : boolean;
  "enableDebugMode"           : boolean;
  "enableNativeContextMenu"   : boolean;
  "enableNativeReloadKeyBinds": boolean;
  "useNativeColorPicker"      : boolean;
};
type ExtensionsType = {
  "list"                      : Array<{ "enabled": boolean; "sha256": string; "label": string }>;
  "permissions"               : Record<string, Record<string, boolean>>;
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
  "atAGlance": Array<{
    "title"   : string;
    "subtitle": string;
  }>;
};
type SelectedType = {
  "account"        : number;
  "currentInstance": string | null;
  "stats"          : "playtime" | "last-launch";
};
type LogsType = {
  "show"      : boolean;
  "mode"      : "kaede-launcher" | string;
  "filtering" : string;
  "lineHeight": number;
  "partsShown": Record<"time" | "level" | "target" | "message", boolean>;
  "partsSize" : Record<"time" | "level" | "target", number>;
};
type MinecraftType = {
  "windowHeight": number;
  "windowWidth" : number;
  "icon"        : string;
  "javaBinary"  : string;
  "add"         : {
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  };
  "remove": {
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  };
};
type SidebarItemsType = Array<"divider" | {
  "path"  : RouteType;
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
type ContextMenuItemsType = Array<{
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
type PagesType = {
  "home"   : Partial<object>;
  "library": Partial<{
    "selected": string;
  }>;
  "settings": Partial<{
    "tab": string;
  }>;
  "profile": Partial<{
    "pending": boolean;
    "step"   : SignInStatusType | null;
    "error"  : string | null;
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
      "icon"         : string;
      "add"          : {
        "jvmArguments" : Array<string>;
        "gameArguments": Array<string>;
      };
      "remove"         : {
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
          currentInstance: GlobalStatesType["pages"]["add-instance"]["instance"],
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

export type GlobalStatesType = {
  // Specified in config (only JSON values)
  "development"     : DevelopmentType;
  "extensions"      : ExtensionsType;
  "ui"              : UIType;
  "selected"        : SelectedType;
  "locale"          : string;
  "logs"            : LogsType;
  "minecraft"       : MinecraftType;
  // Not specified in config (non-JSON values)
  "currentPage"     : RouteType;
  "translations"    : TranslationsType;
  "sidebarItems"    : SidebarItemsType;
  "contextMenuItems": ContextMenuItemsType;
  "pages"           : PagesType;
};
