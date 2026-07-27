import { getValidationErrors } from "@/lib/schemas/errors.ts";
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
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type {
  CompiledValidatorType,
  ValidationArgumentsType,
} from "@/types/schemas/validation-arguments.type.ts";

/*
 * The checks are pre-compiled by 'typebox/compile' at build time
 * ('bun generate:validators'), so the typebox runtime does not ship
 * in the application bundle. Detailed validation errors are still
 * produced on failures by a lazily loaded typebox runtime
 */
const AccountValidator: CompiledValidatorType = {
  "Check" : CheckAccount,
  "Errors": (value: unknown) => getValidationErrors("account", value),
};
const ConfigValidator: CompiledValidatorType = {
  "Check" : CheckConfig,
  "Errors": (value: unknown) => getValidationErrors("config", value),
};
const InstanceMetadataValidator: CompiledValidatorType = {
  "Check" : CheckInstanceMetadata,
  "Errors": (value: unknown) => getValidationErrors("instanceMetadata", value),
};
const ExtensionMetadataValidator: CompiledValidatorType = {
  "Check" : CheckExtensionMetadata,
  "Errors": (value: unknown) => getValidationErrors("extensionMetadata", value),
};

const PatchMetaValidator: CompiledValidatorType = {
  "Check" : CheckPatchMeta,
  "Errors": (value: unknown) => getValidationErrors("patchMeta", value),
};

export default {

  /*
   * If there is additional unknown properties in object, validation will still pass,
   * which is actually good since extensions can use the same config file as the app
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
    "extension": (data: ValidationArgumentsType) => validate<ExtensionMetadataType>({
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
