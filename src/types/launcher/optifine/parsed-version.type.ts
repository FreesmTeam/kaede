// '${mcversion}_${type}_${patch}' from BMCLAPI
export type ParsedOptiFineVersionType = {
  // For example, '1.21.4'
  "minecraftVersion": string;
  // For example, 'HD_U' or 'HD_U_J3' for previews
  "type"            : string;
  // For example, 'J3' or 'pre14' for previews
  "patch"           : string;
};
