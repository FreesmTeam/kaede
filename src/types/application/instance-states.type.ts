import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export type InstanceStateType = GlobalStatesType["minecraft"] & {
  "name"         : string;
  "checksum"     : boolean;
  "playTime"     : number;
  "lastLaunch"   : number;
  "entry"        : ExtendedPatchUIDType;
  "pinned"       : boolean;
  "groups"       : Array<string>;
  "modpackPath" ?: string;
  "patchVersions": {
    "net.minecraft": string;
  } & Partial<
    Record<ExtendedPatchUIDType, string>
  >;
};

/* Per-instance Minecraft settings */
export type InstanceStatesType = Record<string, InstanceStateType>;

