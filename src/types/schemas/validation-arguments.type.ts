import type { TLocalizedValidationError } from "typebox/error";

export interface CompiledValidatorType {
  "Check" : (value: unknown) => boolean;
  "Errors": (value: unknown) => Promise<Array<TLocalizedValidationError>>;
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
