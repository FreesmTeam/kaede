import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

export type ExtensionInfoType = {
  "id"            : string;
  "code"          : string;
  "artifactSha256": string;
} & Partial<{
  "embeddedMetadata": ExtensionMetadataType;
}>;
