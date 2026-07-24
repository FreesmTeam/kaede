import type { PermissionRequest } from "@/types/extensions/permission.type.ts";

export type ExtensionMetadataType = {
  // Should be unique
  "id"        : string;
  "logo"      : string;
  "name"      : string;
  "type"      : "sandbox" | "unrestricted";
  "source"    : string;
  "version"   : string;
  "authors"   : Array<string>;
  // Use ISO 639-1 two-letter language codes
  "languages" : Array<string>;
  "categories": Array<string>;
} & Partial<{
  "description": string;
  "permissions": Array<PermissionRequest>;
  "enabled"    : boolean;
}>;
