export type ValidationSchemaKey =
  | "account"
  | "config"
  | "extensionMetadata"
  | "instanceMetadata"
  | "patchMeta";

export interface CompiledValidatorType {
  "Check" : (value: unknown) => boolean;
  "Errors": (
    value: unknown,
  ) => Promise<Array<import("typebox/error").TLocalizedValidationError>>;
}

export interface ValidationArgumentsType {
  "label": string;
  "info" : {
    "id"   ?: string;
    "index"?: number;
  };
  "value": unknown;
}
export interface FullValidationArgumentsType extends ValidationArgumentsType {
  "schema": CompiledValidatorType;
}
