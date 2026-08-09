export type MrpackManifestFileType = {
  // Relative to the Minecraft directory, e.g., 'mods/sodium.jar'
  "path"    : string;
  "url"     : string;
  "fileSize": number;
  "sha1"    : string;
  "sha512"  : string;
  "external": boolean;
};
export type MrpackManifestType = {
  "formatVersion": number;
  "name"         : string;
  "versionId"    : string;
  "summary"      : string | null;
  // '{ "minecraft": "1.20.1", "fabric-loader": "0.15.11" }'
  "dependencies" : Record<string, string>;
  "files"        : Array<MrpackManifestFileType>;
  "overrides"    : number;
};
