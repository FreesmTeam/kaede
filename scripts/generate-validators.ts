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

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TSchema } from "typebox";
import { Code } from "typebox/compile";

import {
  AccountSchema,
  ConfigSchema,
  ExtensionMetadataSchema,
  InstanceMetadataSchema,
  PatchMetaSchema,
} from "../src/lib/schemas/types";

const OutputDirectory: string = path.join(
  // @ts-expect-error It works
  import.meta.dir,
  "..",
  "src",
  "lib",
  "schemas",
  "generated",
);
const OutputFile: string = path.join(OutputDirectory, "validators.ts");

/*
 * The namespaces that 'Code()' may reference in the emitted checks.
 *
 * Only the ones that are actually used end up as imports in the generated file
 */
const KnownRuntimeImports = {
  "Format" : "typebox/format",
  "Guard"  : "typebox/guard",
  "Hashing": "typebox/system",
} as const;

const Targets: Array<{
  "exportName": string;
  "prefix"    : string;
  "schema"    : TSchema;
}> = [
  {
    "exportName": "CheckAccount",
    "prefix"    : "account",
    "schema"    : AccountSchema,
  },
  {
    "exportName": "CheckConfig",
    "prefix"    : "config",
    "schema"    : ConfigSchema,
  },
  {
    "exportName": "CheckExtensionMetadata",
    "prefix"    : "extensionMetadata",
    "schema"    : ExtensionMetadataSchema,
  },
  {
    "exportName": "CheckInstanceMetadata",
    "prefix"    : "instanceMetadata",
    "schema"    : InstanceMetadataSchema,
  },
  {
    "exportName": "CheckPatchMeta",
    "prefix"    : "patchMeta",
    "schema"    : PatchMetaSchema,
  },
];

function generateCheckFunction({
  exportName,
  prefix,
  schema,
}: typeof Targets[number]): string {
  const generated = Code(schema);

  // Shouldn't happen but still
  if (generated.External.variables.length > 0) {
    throw new Error(
      `Schema for '${exportName}' produced external variables, `
      + "the generated code would not be self-contained",
    );
  }

  const kept: Array<string> = [];

  for (const line of generated.Code.split("\n")) {
    const isBoilerplate: boolean = line.startsWith("import ")
      || line.startsWith("let External")
      || line.startsWith("export function SetExternal");

    if (isBoilerplate) {
      // @ts-expect-error It works
      if (kept.at(-1)?.trim() === "// @ts-ignore") {
        kept.pop();
      }

      continue;
    }

    kept.push(line);
  }

  const processed: string = kept
    .join("\n")
    .trim()
    // @ts-expect-error It works
    .replaceAll(/\bcheck_(?<index>\d+)\b/gu, `${prefix}_check_$<index>`)
    .replace(
      "export function Check(value)",
      `export function ${exportName}(value: unknown): boolean`,
    );

  if (processed.includes("External")) {
    throw new Error(
      `Emitted code for '${exportName}' still references 'External' `
      + "after processing, refusing to generate broken validators",
    );
  }

  return processed;
}

const checks: Array<string> = Targets.map(target => generateCheckFunction(target));
const merged: string = checks.join("\n\n");

const usedImports: Array<string> = Object
  .entries(KnownRuntimeImports)
  .filter(([namespace]) => new RegExp(`\\b${namespace}\\.`, "u").test(merged))
  .map(([namespace, specifier]) => `import { ${namespace} } from "${specifier}";`);

if (usedImports.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    "Note: the emitted checks reference typebox runtime helpers, "
    + "these modules will be included in the bundle:",
    usedImports,
  );
}

const banner: string = `// eslint-disable unicorn/no-abusive-eslint-disable
/* eslint-disable */
// @ts-nocheck

/*
 * GENERATED FILE
 *
 * Standalone validators emitted by 'typebox/compile' at build time
 * to avoid shipping typebox runtime.
 *
 * - Sources    : 'src/lib/schemas/scopes/*'
 * - Regenerate : 'bun generate:validators'
 */
`;

const contents: string = usedImports.length > 0
  ? `${banner}\n${usedImports.join("\n")}\n\n${merged}\n`
  : `${banner}\n${merged}\n`;

// @ts-expect-error Top-level await works
await mkdir(OutputDirectory, { "recursive": true });
// @ts-expect-error Top-level await works
await writeFile(OutputFile, contents);

// eslint-disable-next-line no-console
console.log(
  `Generated ${Targets.length} validators into '${path.relative(process.cwd(), OutputFile)}'`,
);
