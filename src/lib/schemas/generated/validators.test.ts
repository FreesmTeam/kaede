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

import type { TSchema } from "typebox";
import { Compile } from "typebox/compile";
import { Create } from "typebox/value";
import { expect, test } from "vitest";

import {
  CheckAccount,
  CheckConfig,
  CheckExtensionMetadata,
  CheckInstanceMetadata,
  CheckPatchMeta,
} from "@/lib/schemas/generated/validators.js";
import { AccountSchema } from "@/lib/schemas/scopes/accounts";
import { ConfigSchema } from "@/lib/schemas/scopes/config";
import { ExtensionMetadataSchema } from "@/lib/schemas/scopes/extensions";
import { InstanceMetadataSchema } from "@/lib/schemas/scopes/instances";
import { PatchMetaSchema } from "@/lib/schemas/scopes/meta";

const Targets: Array<{
  "name"   : string;
  "check"  : (value: unknown) => boolean;
  "sample"?: () => unknown;
  "schema" : TSchema;
}> = [
  { "name": "account", "check": CheckAccount, "schema": AccountSchema },
  { "name": "config", "check": CheckConfig, "schema": ConfigSchema },
  {
    "name"  : "extensionMetadata",
    "check" : CheckExtensionMetadata,
    "sample": (): unknown => ({
      "id"         : "example.plugin",
      "logo"       : "",
      "name"       : "Example",
      "type"       : "sandbox",
      "source"     : "https://github.com/example/plugin",
      "version"    : "1.0.0",
      "authors"    : [],
      "languages"  : ["en"],
      "categories" : [],
      "permissions": [
        "ui/basic",
        {
          "id"   : "network/http",
          "scope": {
            "origins": ["https://example.com"],
            "methods": ["GET"],
          },
        },
      ],
    }),
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

for (const { name, check, sample = (): unknown => Create(schema), schema } of Targets) {
  const reference = Compile(schema);

  test(`generated '${name}' validator accepts a valid sample`, () => {
    const validSample = sample();

    expect(check(validSample)).toBe(true);
    expect(reference.Check(validSample)).toBe(true);
  });

  test(`generated '${name}' validator matches the compiled one on probes`, () => {
    for (const probe of Probes) {
      expect(check(probe)).toBe(reference.Check(probe));
    }
  });

  test(`generated '${name}' validator matches the compiled one on mutated samples`, () => {
    const validSample = sample();

    if (typeof validSample !== "object" || validSample === null) {
      return;
    }

    for (const key of Object.keys(validSample)) {
      const missingKey = structuredClone(validSample) as Record<string, unknown>;

      delete missingKey[key];
      expect(check(missingKey)).toBe(reference.Check(missingKey));

      const wrongType = structuredClone(validSample) as Record<string, unknown>;

      wrongType[key] = Symbol.for("bogus").toString() + 12_345;
      expect(check(wrongType)).toBe(reference.Check(wrongType));
    }
  });
}

const BaseExtensionMetadata = {
  "id"        : "example.plugin",
  "logo"      : "",
  "name"      : "Example",
  "type"      : "sandbox",
  "source"    : "https://github.com/example/plugin",
  "version"   : "1.0.0",
  "authors"   : [],
  "languages" : ["en"],
  "categories": [],
} as const;

const RefinementProbes: ReadonlyArray<unknown> = [
  { ...BaseExtensionMetadata, "id": "_invalid-leading-character" },
  { ...BaseExtensionMetadata, "id": "constructor" },
  { ...BaseExtensionMetadata, "source": "https://GitHub.com/example/plugin" },
  { ...BaseExtensionMetadata, "version": " 1.0.0" },
  { ...BaseExtensionMetadata, "permissions": ["ui/basic", "ui/basic"] },
  { ...BaseExtensionMetadata, "permissions": ["ui-basic"] },
  {
    ...BaseExtensionMetadata,
    "permissions": [{
      "id"   : "network/http",
      "scope": { "origins": ["https://example.com/path"], "methods": ["GET"] },
    }],
  },
  {
    ...BaseExtensionMetadata,
    "permissions": [{
      "id"   : "storage/external/read",
      "scope": { "roots": ["relative/path"] },
    }],
  },
  {
    ...BaseExtensionMetadata,
    "permissions": [{
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ "path": "relative/tool", "arguments": [] }] },
    }],
  },
  {
    ...BaseExtensionMetadata,
    "permissions": [{
      "id"   : "system/process/spawn",
      "scope": { "executables": [{ "path": "/bin/tool", "arguments": ["bad\u{0}arg"] }] },
    }],
  },
];

test("generated extension validator preserves all host refinement checks", () => {
  const reference = Compile(ExtensionMetadataSchema);

  for (const probe of RefinementProbes) {
    expect(CheckExtensionMetadata(probe)).toBe(reference.Check(probe));
    expect(CheckExtensionMetadata(probe)).toBe(false);
  }
});
