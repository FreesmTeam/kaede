import type { TLocalizedValidationError } from "typebox/error";

import {
  CheckAccount,
  CheckConfig,
  CheckExtensionMetadata,
  CheckInstanceMetadata,
  CheckPatchMeta,
} from "@/lib/schemas/generated/validators.ts";
import { validate } from "@/lib/schemas/validate.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type {
  CompiledValidatorType,
  ValidationArgumentsType,
} from "@/types/schemas/validation-arguments.type.ts";

const handleError = async (
  kind: "account" | "config" | "instance" | "extension" | "patch",
  value: unknown,
): Promise<Array<TLocalizedValidationError>> => {
  const {
    AccountSchema,
    ConfigSchema,
    ExtensionMetadataSchema,
    InstanceMetadataSchema,
    PatchMetaSchema,
    Errors,
  } = await import("@/lib/schemas/types");

  switch (kind) {
    case "account": { return Errors(AccountSchema, value); }
    case "config": { return Errors(ConfigSchema, value); }
    case "extension": { return Errors(ExtensionMetadataSchema, value); }
    case "instance": { return Errors(InstanceMetadataSchema, value); }
    case "patch": { return Errors(PatchMetaSchema, value); }
  }
};

/*
 * The checks are pre-compiled by 'typebox/compile' at build time
 * ('bun generate:validators'), so the typebox compiler is not bundled at runtime.
 *
 * Detailed errors for failed validations are produced by the typebox value engine,
 * loaded dynamically at runtime when necessary (see 'handleError' above)
 */
const AccountValidator: CompiledValidatorType = {
  "Check" : CheckAccount,
  "Errors": (value: unknown) => handleError("account", value),
};
const ConfigValidator: CompiledValidatorType = {
  "Check" : CheckConfig,
  "Errors": (value: unknown) => handleError("config", value),
};
const InstanceMetadataValidator: CompiledValidatorType = {
  "Check" : CheckInstanceMetadata,
  "Errors": (value: unknown) => handleError("instance", value),
};
const ExtensionMetadataValidator: CompiledValidatorType = {
  "Check" : CheckExtensionMetadata,
  "Errors": (value: unknown) => handleError("extension", value),
};
const PatchMetaValidator: CompiledValidatorType = {
  "Check" : CheckPatchMeta,
  "Errors": (value: unknown) => handleError("patch", value),
};

export default {

  /*
   * If there are additional unknown properties in the object, validation will still pass,
   * which is actually good since extensions can use the same config files as the app
   */
  "validate": {
    "account": (data: ValidationArgumentsType) => validate<AccountType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": AccountValidator,
    }),
    "config": (data: ValidationArgumentsType) => validate<ConfigType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": ConfigValidator,
    }),
    "instance": (data: ValidationArgumentsType) => validate<InstanceStateType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": InstanceMetadataValidator,
    }),
    "extension": (data: ValidationArgumentsType) => validate<ExtensionType["metadata"]>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": ExtensionMetadataValidator,
    }),
    "patchMeta": (data: ValidationArgumentsType) => validate<SpecificPatchMetaType>({
      "value" : data.value,
      "info"  : data.info,
      "label" : data.label,
      "schema": PatchMetaValidator,
    }),
  },
  AccountValidator,
  ConfigValidator,
  InstanceMetadataValidator,
  ExtensionMetadataValidator,
  PatchMetaValidator,
} as const;
