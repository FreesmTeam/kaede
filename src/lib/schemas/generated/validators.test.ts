/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { expect, test } from "bun:test";
import type { TSchema } from "typebox";
import { Compile } from "typebox/compile";
import { Create } from "typebox/value";

import {
  CheckAccount,
  CheckConfig,
  CheckExtensionMetadata,
  CheckInstanceMetadata,
  CheckPatchMeta,
} from "@/lib/schemas/generated/validators.ts";
import { AccountSchema } from "@/lib/schemas/types/accounts";
import { ConfigSchema } from "@/lib/schemas/types/config";
import { ExtensionMetadataSchema } from "@/lib/schemas/types/extensions";
import { InstanceMetadataSchema } from "@/lib/schemas/types/instances";
import { PatchMetaSchema } from "@/lib/schemas/types/meta";

const Targets: Array<{
  "name"  : string;
  "check" : (value: unknown) => boolean;
  "schema": TSchema;
}> = [
  { "name": "account", "check": CheckAccount, "schema": AccountSchema },
  { "name": "config", "check": CheckConfig, "schema": ConfigSchema },
  {
    "name"  : "extensionMetadata",
    "check" : CheckExtensionMetadata,
    "schema": ExtensionMetadataSchema,
  },
  { "name": "instanceMetadata", "check": CheckInstanceMetadata, "schema": InstanceMetadataSchema },
  { "name": "patchMeta", "check": CheckPatchMeta, "schema": PatchMetaSchema },
];

const Probes: Array<unknown> = [
  undefined,
  null,
  0,
  42.5,
  "",
  "string",
  true,
  [],
  [{}],
  {},
  { "unexpected": true },
];

for (const { name, check, schema } of Targets) {
  const reference = Compile(schema);

  test(`generated '${name}' validator accepts a valid sample`, () => {
    const sample: unknown = Create(schema);

    expect(check(sample)).toBe(true);
    expect(reference.Check(sample)).toBe(true);
  });

  test(`generated '${name}' validator matches the compiled one on probes`, () => {
    for (const probe of Probes) {
      expect(check(probe)).toBe(reference.Check(probe));
    }
  });

  test(`generated '${name}' validator matches the compiled one on mutated samples`, () => {
    const sample: unknown = Create(schema);

    if (typeof sample !== "object" || sample === null) {
      return;
    }

    for (const key of Object.keys(sample)) {
      const missingKey = structuredClone(sample) as Record<string, unknown>;

      delete missingKey[key];
      expect(check(missingKey)).toBe(reference.Check(missingKey));

      const wrongType = structuredClone(sample) as Record<string, unknown>;

      wrongType[key] = Symbol.for("bogus").toString() + 12_345;
      expect(check(wrongType)).toBe(reference.Check(wrongType));
    }
  });
}
