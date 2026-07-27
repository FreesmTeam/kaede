import { Errors } from "typebox/value";

import {
  CheckAccount,
  CheckConfig,
  CheckExtensionMetadata,
  CheckInstanceMetadata,
  CheckPatchMeta,
} from "@/lib/schemas/generated/validators.ts";
import { AccountSchema } from "@/lib/schemas/scopes/accounts";
import { ConfigSchema } from "@/lib/schemas/scopes/config";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extensions";
import { InstanceMetadataSchema } from "@/lib/schemas/scopes/instances";
import { PatchMetaSchema } from "@/lib/schemas/scopes/meta";
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
 * ('bun generate:validators'), so neither the typebox compiler
 * nor its 'new Function' evaluation run at startup. Detailed errors
 * for failed validations are produced by the typebox value engine
 */
const AccountValidator: CompiledValidatorType = {
  "Check" : CheckAccount,
  "Errors": (value: unknown) => Errors(AccountSchema, value),
};
const ConfigValidator: CompiledValidatorType = {
  "Check" : CheckConfig,
  "Errors": (value: unknown) => Errors(ConfigSchema, value),
};
const InstanceMetadataValidator: CompiledValidatorType = {
  "Check" : CheckInstanceMetadata,
  "Errors": (value: unknown) => Errors(InstanceMetadataSchema, value),
};
const ExtensionMetadataValidator: CompiledValidatorType = {
  "Check" : CheckExtensionMetadata,
  "Errors": (value: unknown) => Errors(ExtensionMetadataSchema, value),
};

const PatchMetaValidator: CompiledValidatorType = {
  "Check" : CheckPatchMeta,
  "Errors": (value: unknown) => Errors(PatchMetaSchema, value),
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
