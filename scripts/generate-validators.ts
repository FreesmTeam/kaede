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

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TSchema } from "typebox";
import { Code } from "typebox/compile";

import { AccountSchema } from "../src/lib/schemas/scopes/accounts";
import { ConfigSchema } from "../src/lib/schemas/scopes/config";
import {
  ExtensionMetadataCodegenSchema,
} from "../src/lib/schemas/scopes/extensions";
import { InstanceMetadataSchema } from "../src/lib/schemas/scopes/instances";
import { PatchMetaSchema } from "../src/lib/schemas/scopes/meta";

type PostCheck = Readonly<{
  "importName": string;
  "specifier" : string;
}>;

type ValidatorTarget = Readonly<{
  "exportName" : string;
  "postCheck" ?: PostCheck;
  "prefix"     : string;
  "schema"     : TSchema;
}>;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(repositoryRoot, "src", "lib", "schemas", "generated");
const outputJavaScript = path.join(outputDirectory, "validators.js");
const outputDeclarations = path.join(outputDirectory, "validators.d.ts");
const checkOnly = process.argv.includes("--check");

/*
 * The namespaces that Code() may reference in emitted checks. Only the
 * namespaces that survive post-processing are imported by the generated file.
 */
const KnownRuntimeImports = {
  "Format" : "typebox/format",
  "Guard"  : "typebox/guard",
  "Hashing": "typebox/system",
} as const;

const Targets: ReadonlyArray<ValidatorTarget> = [
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
    "postCheck" : {
      "importName": "hasValidExtensionMetadataRefinements",
      "specifier" : "../scopes/extensions/refinements.ts",
    },
    "prefix": "extensionMetadata",
    "schema": ExtensionMetadataCodegenSchema,
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

function stripTypeBoxModuleBoilerplate(code: string): string {
  const kept: Array<string> = [];

  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    const isBoilerplate = line.startsWith("import ") ||
      trimmed === "// @ts-ignore" ||
      (/^let External = \[\]$/u).test(trimmed) ||
      trimmed.startsWith("export function SetExternal(");

    if (!isBoilerplate) {
      kept.push(line);
    }
  }

  return kept.join("\n").trim();
}

function generateCheckFunction(target: ValidatorTarget): string {
  const generated = Code(target.schema);

  if (generated.External.variables.length > 0) {
    throw new Error(
      `Schema for '${target.exportName}' produced external variables; ` +
      "move non-serializable refinements into its explicit post-check",
    );
  }

  const renamed = stripTypeBoxModuleBoilerplate(generated.Code)
    .replaceAll(/\bcheck_(\d+)\b/gu, (_match, index: string): string => {
      return `${target.prefix}_check_${index}`;
    });
  const exportPattern = /^export function Check\(value\) \{(?<body>.*)\}$/mu;
  const exportMatch = exportPattern.exec(renamed);

  if (exportMatch?.groups?.body === undefined) {
    throw new Error(`TypeBox emitted an unsupported export shape for '${target.exportName}'`);
  }

  const body = exportMatch.groups.body;
  const exportedFunction = target.postCheck === undefined
    ? `export function ${target.exportName}(value) {${body}}`
    : [
      `function ${target.exportName}Generated(value) {${body}}`,
      "",
      `export function ${target.exportName}(value) {`,
      `  return ${target.exportName}Generated(value) && ${target.postCheck.importName}(value);`,
      "}",
    ].join("\n");
  const processed = renamed.replace(exportPattern, (): string => exportedFunction);

  if ((/\bExternal\b/u).test(processed)) {
    throw new Error(
      `Emitted code for '${target.exportName}' still references External`,
    );
  }

  return processed;
}

function createRuntimeImports(generatedCode: string): Array<string> {
  const typeBoxImports = Object.entries(KnownRuntimeImports)
    .filter(([namespace]) => new RegExp(`\\b${namespace}\\.`, "u").test(generatedCode))
    .map(([namespace, specifier]) => `import { ${namespace} } from "${specifier}";`);
  const postCheckImports = Targets.flatMap(target => {
    return target.postCheck === undefined
      ? []
      : [
        `import { ${target.postCheck.importName} } from "${target.postCheck.specifier}";`,
      ];
  });

  return [...typeBoxImports, ...postCheckImports];
}

function createDeclarations(): string {
  const functions = Targets.map(target => {
    return `export declare function ${target.exportName}(value: unknown): boolean;`;
  });

  return "// Generated by scripts/generate-validators.ts; do not edit directly.\n\n" +
    `${functions.join("\n")}\n`;
}

async function writeOrCheck(filePath: string, contents: string): Promise<void> {
  if (checkOnly) {
    const checkedIn = await readFile(filePath, "utf8");

    if (checkedIn !== contents) {
      throw new Error(
        `${path.relative(repositoryRoot, filePath)} is stale; run bun run generate:validators`,
      );
    }

    return;
  }

  await writeFile(filePath, contents);
}

const checks = Targets.map(target => generateCheckFunction(target));
const merged = checks.join("\n\n");
const runtimeImports = createRuntimeImports(merged);

if (runtimeImports.some(statement => statement.includes("typebox/"))) {
  process.stderr.write(
    "Generated checks reference small TypeBox runtime helpers: " +
    `${runtimeImports.filter(statement => statement.includes("typebox/")).join(", ")}\n`,
  );
}

const banner = `/*
 * GENERATED FILE - DO NOT EDIT
 *
 * Standalone validators emitted by typebox/compile at build time.
 * Regenerate with: bun run generate:validators
 */
`;
const javaScript = runtimeImports.length > 0
  ? `${banner}\n${runtimeImports.join("\n")}\n\n${merged}\n`
  : `${banner}\n${merged}\n`;

await mkdir(outputDirectory, { "recursive": true });
await Promise.all([
  writeOrCheck(outputJavaScript, javaScript),
  writeOrCheck(outputDeclarations, createDeclarations()),
]);

process.stdout.write(
  `${checkOnly ? "Checked" : "Generated"} ${Targets.length} validators\n`,
);
